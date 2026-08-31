import express, { type RequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import {
  ALREADY_RESERVED,
  NOT_RESERVER,
  NOT_OWNER,
  NOT_FOUND,
  INVALID_TRANSITION,
  COMMITTED_LOCKED,
  type RequestsStore,
} from './requestsStore';
import type { Translator } from './translator';
import type { CakeRequest, RequestDraft } from './types';
import {
  createSupabaseProfilesStore,
  BAKER_NOT_FOUND,
  type ProfilesStore,
  type NotificationPrefs,
} from './profilesStore';
import { attentionReason, type AttentionReason } from './attention';
import { matchesCapabilities } from './matching';
import { AREAS, DIETARY_OPTIONS, KASHRUT_OPTIONS, joinList, parseList } from './options';
import { normalizePhone } from './phone';
import { createSupabasePushStore, type PushStore, type PushSubscriptionInput } from './pushStore';
import { createWebPushSender, type PushSender } from './pushSender';
import { notifyMatchingBakers } from './pushNotify';
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

// The required fields a new request must include. Dietary and the recipient
// note are optional; everything else (including the kashrut level) is required.
function isMissingRequired(draft: Partial<RequestDraft>): boolean {
  return (
    !draft.recipient ||
    !draft.occasion ||
    !draft.neededBy ||
    !draft.location ||
    !draft.kashrut ||
    !draft.contactPhone
  );
}

// The "about the recipient" note: everyone browsing sees a short preview; the
// assigned baker (and owner/admin) sees the whole note alongside the contact
// details. Plain truncation at a word boundary — not an AI summary.
const ABOUT_RECIPIENT_MAX = 500; // most a requester can store
const ABOUT_PREVIEW_MAX = 140; // most a non-holder sees

function previewText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + '…';
}

// Validates a baker's notification preferences from the request body: the flag
// must be a boolean, and every area / dietary / kashrut value must come from the
// shared lists. Returns clean, de-duplicated prefs, or null when malformed.
function parseNotificationPrefs(body: unknown): NotificationPrefs | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.notifyNewRequests !== 'boolean') return null;
  const asList = (value: unknown, allowed: readonly string[]): string[] | null => {
    if (!Array.isArray(value)) return null;
    const seen = new Set<string>();
    for (const item of value) {
      if (typeof item !== 'string' || !allowed.includes(item)) return null;
      seen.add(item);
    }
    return [...seen];
  };
  const areas = asList(b.areas, AREAS);
  const dietary = asList(b.dietary, DIETARY_OPTIONS);
  const kashrut = asList(b.kashrut, KASHRUT_OPTIONS);
  if (areas === null || dietary === null || kashrut === null) return null;
  return { notifyNewRequests: b.notifyNewRequests, areas, dietary, kashrut };
}

// Validates a browser push subscription from the request body. The browser hands
// us PushSubscription.toJSON() — { endpoint, keys: { p256dh, auth } } — and we
// need all three as non-empty strings. Returns the flattened input, or null.
function parsePushSubscription(body: unknown): PushSubscriptionInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { endpoint?: unknown; keys?: unknown };
  if (typeof b.endpoint !== 'string' || b.endpoint.trim() === '') return null;
  if (typeof b.keys !== 'object' || b.keys === null) return null;
  const keys = b.keys as { p256dh?: unknown; auth?: unknown };
  if (typeof keys.p256dh !== 'string' || keys.p256dh === '') return null;
  if (typeof keys.auth !== 'string' || keys.auth === '') return null;
  return { endpoint: b.endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

// Validates and normalizes a submitted request body (shared by create and edit).
// Returns a clean RequestDraft, or a message to send back as a 400. The area,
// kashrut and dietary values must all come from the shared lists; a request may
// name several acceptable kashrut levels (at least one), and dietary needs are
// optional. The contact phone is validated and canonicalized.
function buildRequestDraft(body: Partial<RequestDraft>): { draft: RequestDraft } | { error: string } {
  if (isMissingRequired(body)) return { error: 'Missing required fields' };
  const contactPhone = normalizePhone(body.contactPhone!);
  if (contactPhone === null) {
    return { error: 'Please enter a valid phone number, e.g. 050-123-4567 or +972 50-123-4567.' };
  }
  if (!(AREAS as readonly string[]).includes(body.location!)) {
    return { error: 'Please choose a delivery area from the list.' };
  }
  const kashrutParts = parseList(body.kashrut ?? '');
  if (
    kashrutParts.length === 0 ||
    kashrutParts.some((part) => !(KASHRUT_OPTIONS as readonly string[]).includes(part))
  ) {
    return { error: 'Please choose the kashrut level(s) from the list.' };
  }
  const dietaryParts = parseList(body.dietary ?? '');
  if (dietaryParts.some((part) => !(DIETARY_OPTIONS as readonly string[]).includes(part))) {
    return { error: 'Please choose dietary needs from the list.' };
  }
  return {
    draft: {
      recipient: body.recipient!,
      occasion: body.occasion!,
      neededBy: body.neededBy!,
      dietary: joinList(dietaryParts), // normalize the stored spacing
      location: body.location!,
      kashrut: joinList(kashrutParts),
      aboutRecipient: (body.aboutRecipient ?? '').slice(0, ABOUT_RECIPIENT_MAX).trim(),
      contactPhone,
    },
  };
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
  // The requester's phone is private — the assigned baker sees it in-app.
  if (request.contactPhone) result = { ...result, contactPhone: '' };
  // The recipient note is shown to everyone, but non-holders get only a short
  // preview; the assigned baker sees the whole thing with the contact details.
  if (request.aboutRecipient) {
    const preview = previewText(request.aboutRecipient, ABOUT_PREVIEW_MAX);
    if (preview !== request.aboutRecipient) result = { ...result, aboutRecipient: preview };
  }
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
  pushStore: PushStore = createSupabasePushStore(),
  pushSender: PushSender = createWebPushSender(),
) {
  const app = express();
  // In production, restrict which sites' browsers may call this API to the
  // frontend origin(s) listed in CORS_ORIGIN (comma-separated). When it's unset
  // — local dev and tests — any origin is allowed, exactly as before.
  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : {}));
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

  // A baker reads their own notification preferences (opt-in + which areas /
  // dietary needs / kashrut levels they can make). Baker-only, and always keyed
  // to their own verified id — a baker can never read anyone else's.
  app.get('/api/me/notifications', auth, requireRole('baker'), async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      res.json(await profilesStore.getNotificationSettings(me.id));
    } catch {
      res.status(500).json({ error: 'Could not load your notification settings' });
    }
  });

  // A baker saves their own notification preferences.
  app.put('/api/me/notifications', auth, requireRole('baker'), async (req, res) => {
    const prefs = parseNotificationPrefs(req.body);
    if (!prefs) {
      res.status(400).json({ error: 'Invalid notification settings' });
      return;
    }
    const me = (req as AuthedRequest).auth;
    try {
      res.json(await profilesStore.setNotificationSettings(me.id, prefs));
    } catch {
      res.status(500).json({ error: 'Could not save your notification settings' });
    }
  });

  // The 🔔 bell: open requests relevant to this baker that are new since they
  // last looked. Relevant = matches their areas/dietary/kashrut and still open;
  // "new" = created after their last look (all of them the first time). Baker-
  // only and pull-based (recomputed each call) — no live push.
  app.get('/api/me/notifications/new', auth, requireRole('baker'), async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const settings = await profilesStore.getNotificationSettings(me.id);
      if (!settings.notifyNewRequests) {
        res.json({ count: 0, items: [] });
        return;
      }
      const requests = await store.listRequests();
      const relevant = requests
        .filter((r) => r.status === 'open' && matchesCapabilities(r, settings))
        .filter((r) => settings.seenAt === null || r.createdAt > settings.seenAt)
        .sort((a, b) => b.createdAt - a.createdAt);
      res.json({
        count: relevant.length,
        items: relevant.map((r) => ({ id: r.id, occasion: r.occasion, area: r.location })),
      });
    } catch {
      res.status(500).json({ error: 'Could not load your notifications' });
    }
  });

  // Clears the bell's count by recording that the baker just looked.
  app.post('/api/me/notifications/seen', auth, requireRole('baker'), async (req, res) => {
    const me = (req as AuthedRequest).auth;
    try {
      const seenAt = await profilesStore.markNotificationsSeen(me.id);
      res.json({ seenAt });
    } catch {
      res.status(500).json({ error: 'Could not update your notifications' });
    }
  });

  // A baker turns on web push for the device they're using: the browser hands
  // over a push subscription (endpoint + keys) that we store, keyed to them.
  // Baker-only and keyed to their verified id — no baker can subscribe on
  // another's behalf. Idempotent: re-enabling the same device updates its row.
  app.post('/api/me/push-subscriptions', auth, requireRole('baker'), async (req, res) => {
    const sub = parsePushSubscription(req.body);
    if (!sub) {
      res.status(400).json({ error: 'Invalid push subscription' });
      return;
    }
    const me = (req as AuthedRequest).auth;
    try {
      await pushStore.saveSubscription(me.id, sub);
      res.status(201).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Could not save your push subscription' });
    }
  });

  // A baker turns web push off for this device (identified by its endpoint).
  // Scoped to their own id, and idempotent — clearing one already gone is fine.
  app.delete('/api/me/push-subscriptions', auth, requireRole('baker'), async (req, res) => {
    const { endpoint } = (req.body ?? {}) as { endpoint?: unknown };
    if (typeof endpoint !== 'string' || endpoint.trim() === '') {
      res.status(400).json({ error: 'Missing endpoint' });
      return;
    }
    const me = (req as AuthedRequest).auth;
    try {
      await pushStore.removeSubscription(me.id, endpoint);
      res.status(204).end();
    } catch {
      res.status(500).json({ error: 'Could not remove your push subscription' });
    }
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
    const result = buildRequestDraft((req.body ?? {}) as Partial<RequestDraft>);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    try {
      // The owner is the verified signed-in user, never taken from the body.
      const ownerId = (req as AuthedRequest).auth.id;
      const saved = await store.addRequest(result.draft, ownerId);
      // Answer the requester first — they must never wait on notifications going
      // out to other people…
      res.status(201).json(saved);
      // …then push it to every verified, opted-in baker whose capabilities match
      // (the 🔔 bell still shows it too). Fire-and-forget + best-effort: a push
      // failure can never affect the request that was just created.
      void notifyMatchingBakers(saved, { profilesStore, pushStore, pushSender }).catch(() => {});
    } catch {
      res.status(500).json({ error: 'Could not save request' });
    }
  });

  // The owner (or an admin) edits their request — same validation as creating,
  // but only allowed while the request is still open (once a baker has taken it,
  // the store answers 409). Authorized by ownership, not role.
  app.patch('/api/requests/:id', auth, async (req, res) => {
    const result = buildRequestDraft((req.body ?? {}) as Partial<RequestDraft>);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    const me = (req as AuthedRequest).auth;
    try {
      const updated = await store.updateRequest(
        req.params.id,
        me.id,
        me.role === 'admin',
        result.draft,
      );
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      if (err instanceof Error && err.message === NOT_OWNER) {
        res.status(403).json({ error: 'You can only edit your own request' });
        return;
      }
      if (err instanceof Error && err.message === INVALID_TRANSITION) {
        res.status(409).json({ error: 'This request can no longer be edited — a baker has taken it' });
        return;
      }
      res.status(500).json({ error: 'Could not update this request' });
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
      // The baker now sees the requester's delivery phone in-app on this cake's
      // card (returned unredacted to the assigned baker) — no email is sent.
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
      if (err instanceof Error && err.message === COMMITTED_LOCKED) {
        res.status(403).json({
          error:
            'Once you commit to bake a cake, only an admin can release it. Please contact an admin if you can’t fulfil it.',
        });
        return;
      }
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
