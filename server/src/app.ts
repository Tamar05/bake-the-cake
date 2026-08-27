import express, { type RequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import {
  ALREADY_RESERVED,
  NOT_RESERVER,
  NOT_OWNER,
  NOT_FOUND,
  INVALID_TRANSITION,
  type RequestsStore,
} from './requestsStore';
import type { Translator } from './translator';
import type { CakeRequest, RequestDraft } from './types';
import {
  createSupabaseProfilesStore,
  BAKER_NOT_FOUND,
  type ProfilesStore,
} from './profilesStore';
import { attentionReason, type AttentionReason } from './attention';
import { normalizePhone } from './phone';
import { createResendNotifier, type Notifier } from './emailer';
import {
  createSupabaseAuthenticator,
  requireAuth,
  requireRole,
  requireVerifiedBaker,
  optionalAuth,
  type Authenticator,
  type AuthedRequest,
  type AuthedProfile,
} from './auth';

// The required fields a new request must include.
function isMissingRequired(draft: Partial<RequestDraft>): boolean {
  return (
    !draft.recipient ||
    !draft.occasion ||
    !draft.neededBy ||
    !draft.location ||
    !draft.contactPhone
  );
}

// Trims private details a viewer isn't allowed to see. Only the owner (the
// requester who posted it), the baker holding it, or an admin may see the
// requester's delivery phone, the claimant's identity, and that a (private)
// photo exists. Everyone else — including anonymous browsers — gets a plain card.
function redactReserver(request: CakeRequest, viewer: AuthedProfile | undefined): CakeRequest {
  const maySee =
    viewer != null &&
    (viewer.role === 'admin' ||
      viewer.id === request.reservedByUserId ||
      viewer.id === request.ownerId);
  if (maySee) return request;

  let result = request;
  // The requester's phone is private — reached only via the baker's commit email.
  if (request.contactPhone) result = { ...result, contactPhone: '' };
  // The gallery caption is only public through the gallery endpoint, once shared.
  if (request.galleryCaption) result = { ...result, galleryCaption: '' };
  // Hide who's baking it AND that a (private) photo exists.
  if (request.reservedByUserId != null || request.reservedBy != null) {
    result = { ...result, reservedBy: null, reservedContact: null, reservedByUserId: null, hasPhoto: false };
  }
  return result;
}

// Accepts an optional finished-cake photo on the deliver request. Held in memory
// (never written to disk here), capped at 5 MB, and limited to common image
// types. Multer's own errors (too big / wrong type) become a clean 400.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('INVALID_TYPE'));
  },
});
const acceptPhoto: RequestHandler = (req, res, next) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: 'Invalid photo (JPEG, PNG or WebP, up to 5 MB)' });
      return;
    }
    next();
  });
};

// Builds the Express app around a store (real Supabase store in production,
// an in-memory fake in tests).
export function createApp(
  store: RequestsStore,
  translator: Translator,
  authenticator: Authenticator = createSupabaseAuthenticator(),
  profilesStore: ProfilesStore = createSupabaseProfilesStore(),
  notifier: Notifier = createResendNotifier(),
) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const auth = requireAuth(authenticator);
  const optAuth = optionalAuth(authenticator);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // The public inspiration gallery — no login. Only cakes both the requester and
  // the baker agreed to show; each item is just a photo + optional caption.
  app.get('/api/gallery', async (_req, res) => {
    try {
      res.json(await store.listGallery());
    } catch {
      res.status(500).json({ error: 'Could not load the gallery' });
    }
  });

  // Who am I? Returns the signed-in person's profile (verified server-side).
  app.get('/api/me', auth, (req, res) => {
    res.json((req as AuthedRequest).auth);
  });

  app.get('/api/requests', optAuth, async (req, res) => {
    const viewer = (req as AuthedRequest).auth as AuthedProfile | undefined;
    try {
      const requests = await store.listRequests();
      res.json(requests.map((r) => redactReserver(r, viewer)));
    } catch {
      res.status(500).json({ error: 'Could not load requests' });
    }
  });

  app.post('/api/requests', auth, requireRole('requester', 'admin'), async (req, res) => {
    const draft = (req.body ?? {}) as Partial<RequestDraft>;
    if (isMissingRequired(draft)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // The contact phone must be a real number. Local Israeli numbers are accepted
    // and stored in canonical +972… form; a number that already carries its own
    // country code keeps it. Anything that isn't a valid number is refused.
    const contactPhone = normalizePhone(draft.contactPhone!);
    if (contactPhone === null) {
      res.status(400).json({ error: 'Please enter a valid phone number, e.g. 050-123-4567 or +972 50-123-4567.' });
      return;
    }
    try {
      // The owner is the verified signed-in user, never taken from the body.
      const ownerId = (req as AuthedRequest).auth.id;
      const saved = await store.addRequest(
        {
          recipient: draft.recipient!,
          occasion: draft.occasion!,
          neededBy: draft.neededBy!,
          dietary: draft.dietary ?? '',
          location: draft.location!,
          contactPhone,
        },
        ownerId,
      );
      // Best-effort: alert verified bakers there's a new cake to make (no
      // requester contact — that stays private until a baker commits). A mail
      // failure never affects saving the request.
      try {
        const bakerEmails = await profilesStore.getVerifiedBakerEmails();
        if (bakerEmails.length > 0) {
          await notifier.sendNewRequestAlert(bakerEmails, {
            recipient: saved.recipient,
            occasion: saved.occasion,
            neededBy: saved.neededBy,
            dietary: saved.dietary,
            location: saved.location,
            requestId: saved.id,
          });
        }
      } catch {
        // swallow — the request was saved
      }
      res.status(201).json(saved);
    } catch {
      res.status(500).json({ error: 'Could not save request' });
    }
  });

  app.post(
    '/api/requests/:id/reserve',
    auth,
    requireRole('baker', 'admin'),
    requireVerifiedBaker,
    async (req, res) => {
    // The baker's name + contact come from their verified profile, not the body.
    const me = (req as AuthedRequest).auth;
    try {
      const updated = await store.reserveRequest(
        req.params.id,
        me.id,
        me.displayName,
        me.contact ?? '',
      );
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === ALREADY_RESERVED) {
        res.status(409).json({ error: 'This request is already reserved' });
        return;
      }
      res.status(500).json({ error: 'Could not reserve this request' });
    }
  });

  // The reserving baker (or an admin) commits to bake a request they're holding,
  // turning the 1-hour hold into a lasting claim. Only valid from `reserved`.
  app.post('/api/requests/:id/commit', auth, requireRole('baker', 'admin'), async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const updated = await store.commitRequest(req.params.id, me.id, me.role === 'admin');
      // Email the baker the request details (location + requester contact) so
      // they can bake and deliver. Best-effort: a mail failure never breaks the
      // commit. We look up the requester's contact from their profile.
      if (me.email) {
        try {
          // Prefer the phone the requester gave on the request itself; fall back
          // to their profile contact (e.g. older requests without a phone).
          let requesterContact: string | null = updated.contactPhone || null;
          if (!requesterContact && updated.ownerId) {
            const contacts = await profilesStore.getContacts([updated.ownerId]);
            requesterContact = contacts[updated.ownerId] ?? null;
          }
          await notifier.sendBakeConfirmation(me.email, {
            bakerName: me.displayName,
            recipient: updated.recipient,
            occasion: updated.occasion,
            neededBy: updated.neededBy,
            dietary: updated.dietary,
            location: updated.location,
            requesterContact,
            requestId: updated.id,
          });
        } catch {
          // swallow — the commit already succeeded
        }
      }
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_RESERVER) {
        res.status(403).json({ error: 'Only the baker holding this request can commit to it' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'This request is not in a state that can be committed' });
        return;
      }
      res.status(500).json({ error: 'Could not commit to this request' });
    }
  });

  // The baker who committed marks the cake delivered (committed → delivered),
  // optionally attaching one finished-cake photo (multipart field `photo`).
  app.post(
    '/api/requests/:id/deliver',
    auth,
    requireRole('baker', 'admin'),
    acceptPhoto,
    async (req, res) => {
    const me = (req as AuthedRequest).auth;
    const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
    const photo = file ? { buffer: file.buffer, contentType: file.mimetype } : undefined;
    try {
      const updated = await store.deliverRequest(req.params.id, me.id, me.role === 'admin', photo);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_RESERVER) {
        res.status(403).json({ error: 'Only the baker baking this request can mark it delivered' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'This request is not being baked, so it cannot be delivered' });
        return;
      }
      res.status(500).json({ error: 'Could not mark this request delivered' });
    }
  });

  // The person who owns the request confirms receipt (delivered → received).
  // Authorized by ownership (the store checks owner-or-admin), not by role — the
  // owner is the authority here whatever role their account carries.
  app.post('/api/requests/:id/receive', auth, async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const updated = await store.receiveRequest(req.params.id, me.id, me.role === 'admin');
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_OWNER) {
        res.status(403).json({ error: 'Only the requester who asked for this cake can confirm it' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'This request has not been delivered yet' });
        return;
      }
      res.status(500).json({ error: 'Could not confirm this request' });
    }
  });

  // Hands an authorized viewer (owner / baker / admin) a short-lived signed URL
  // for the finished-cake photo. The bucket is private, so this is the only way
  // to see it; everyone else is refused.
  app.get('/api/requests/:id/photo', auth, async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const url = await store.createPhotoUrl(req.params.id, me.id, me.role === 'admin');
      res.status(200).json({ url });
    } catch (err) {
      if (err instanceof Error && err.message === NOT_OWNER) {
        res.status(403).json({ error: 'You are not allowed to see this photo' });
        return;
      }
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'No photo for this request' });
        return;
      }
      res.status(500).json({ error: 'Could not load the photo' });
    }
  });

  // The requester or the baker toggles their agreement to show a received cake
  // in the public gallery (both must agree), and may set the caption. An admin
  // sending { share: false } pulls it from the gallery (moderation).
  app.post('/api/requests/:id/gallery', auth, async (req, res) => {
    const me = (req as AuthedRequest).auth;
    const body = (req.body ?? {}) as { share?: unknown; caption?: unknown };
    if (typeof body.share !== 'boolean') {
      res.status(400).json({ error: 'Missing or invalid "share" flag' });
      return;
    }
    if (body.caption !== undefined && typeof body.caption !== 'string') {
      res.status(400).json({ error: 'Invalid caption' });
      return;
    }
    const caption =
      typeof body.caption === 'string' ? body.caption.slice(0, 200).trim() : undefined;
    try {
      const updated = await store.setGalleryShare(
        req.params.id,
        me.id,
        me.role === 'admin',
        body.share,
        caption,
      );
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_OWNER) {
        res.status(403).json({ error: 'Only the requester or the baker can share this cake' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'Only a received cake with a photo can be shared' });
        return;
      }
      res.status(500).json({ error: 'Could not update gallery sharing' });
    }
  });

  // Admin moderation: remove a request's finished-cake photo.
  app.delete('/api/requests/:id/photo', auth, requireRole('admin'), async (req, res) => {
    try {
      const updated = await store.removePhoto(req.params.id);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      res.status(500).json({ error: 'Could not remove the photo' });
    }
  });

  app.post('/api/requests/:id/release', auth, async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const updated = await store.releaseRequest(req.params.id, me.id, me.role === 'admin');
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_RESERVER) {
        res.status(403).json({ error: 'Only the baker who reserved it can release it' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'A delivered cake can no longer be released' });
        return;
      }
      res.status(500).json({ error: 'Could not release this request' });
    }
  });

  // Delete a request. Only the owner (cancel your own) or an admin (remove
  // anything) may do this; the store re-checks and this fails closed. Legacy
  // rows with no owner are admin-only. Missing token → 401 (from `auth`),
  // wrong person → 403, unknown id → 404.
  app.delete('/api/requests/:id', auth, async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      await store.deleteRequest(req.params.id, me.id, me.role === 'admin');
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_OWNER) {
        res.status(403).json({ error: 'You can only delete your own request' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'A delivered cake can no longer be cancelled' });
        return;
      }
      res.status(500).json({ error: 'Could not delete this request' });
    }
  });

  // Admin: list every baker with their verification state.
  app.get('/api/bakers', auth, requireRole('admin'), async (_req, res) => {
    try {
      res.json(await profilesStore.listBakers());
    } catch {
      res.status(500).json({ error: 'Could not load bakers' });
    }
  });

  // Admin: verify or unverify a baker. Only a verified baker may reserve/bake.
  app.post('/api/bakers/:id/verification', auth, requireRole('admin'), async (req, res) => {
    const { verified } = (req.body ?? {}) as { verified?: unknown };
    if (typeof verified !== 'boolean') {
      res.status(400).json({ error: 'Missing or invalid "verified" flag' });
      return;
    }
    try {
      const updated = await profilesStore.setVerified(req.params.id, verified);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === BAKER_NOT_FOUND) {
        res.status(404).json({ error: 'No such baker' });
        return;
      }
      res.status(500).json({ error: 'Could not update this baker' });
    }
  });

  // Admin: a small overview of the whole service, from data we already have.
  app.get('/api/stats', auth, requireRole('admin'), async (_req, res) => {
    try {
      const requests = await store.listRequests();
      const now = Date.now();
      const byStatus = { open: 0, reserved: 0, committed: 0, delivered: 0, received: 0 };
      let needsAttention = 0;
      for (const request of requests) {
        byStatus[request.status] += 1;
        if (attentionReason(request, now) !== null) needsAttention += 1;
      }
      const bakers = await profilesStore.listBakers();
      res.json({
        requests: { total: requests.length, ...byStatus },
        bakers: { total: bakers.length, verified: bakers.filter((b) => b.verified).length },
        needsAttention,
      });
    } catch {
      res.status(500).json({ error: 'Could not load the stats' });
    }
  });

  // Admin: the "needs attention" list — stuck requests (unclaimed too long, or
  // overdue), each enriched with the requester's contact so an admin can reach
  // out. The requester's contact is only ever revealed here, to admins.
  app.get('/api/attention', auth, requireRole('admin'), async (_req, res) => {
    try {
      const requests = await store.listRequests();
      const now = Date.now();
      const flagged = requests
        .map((request) => ({ request, reason: attentionReason(request, now) }))
        .filter(
          (x): x is { request: CakeRequest; reason: AttentionReason } => x.reason !== null,
        );
      const ownerIds = [
        ...new Set(flagged.map((x) => x.request.ownerId).filter((v): v is string => v != null)),
      ];
      const contacts = await profilesStore.getContacts(ownerIds);
      res.json(
        flagged.map((x) => ({
          ...x.request,
          reason: x.reason,
          ownerContact: x.request.ownerId ? contacts[x.request.ownerId] ?? null : null,
        })),
      );
    } catch {
      res.status(500).json({ error: 'Could not load the attention list' });
    }
  });

  app.post('/api/translate', async (req, res) => {
    const { text, to } = (req.body ?? {}) as { text?: string; to?: string };
    if (!text || !text.trim() || (to !== 'en' && to !== 'he')) {
      res.status(400).json({ error: 'Missing text or invalid target language' });
      return;
    }
    const from = to === 'he' ? 'en' : 'he';
    try {
      const translated = await translator.translate(text, from, to);
      res.status(200).json({ translated });
    } catch {
      res.status(500).json({ error: 'Could not translate' });
    }
  });

  return app;
}
