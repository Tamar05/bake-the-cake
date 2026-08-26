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
  return !draft.recipient || !draft.occasion || !draft.neededBy || !draft.location;
}

// A claimed request (reserved or committed) only reveals who has it (name +
// contact + their id) to the baker holding it, the requester who posted it, or
// an admin. Everyone else — including anonymous browsers — sees a plain card
// with no baker details.
function redactReserver(request: CakeRequest, viewer: AuthedProfile | undefined): CakeRequest {
  if (request.reservedByUserId == null && request.reservedBy == null) return request;
  const maySee =
    viewer != null &&
    (viewer.role === 'admin' ||
      viewer.id === request.reservedByUserId ||
      viewer.id === request.ownerId);
  if (maySee) return request;
  // Hide who's baking it AND that a (private) photo exists from everyone else.
  return { ...request, reservedBy: null, reservedContact: null, reservedByUserId: null, hasPhoto: false };
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
) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const auth = requireAuth(authenticator);
  const optAuth = optionalAuth(authenticator);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
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
        },
        ownerId,
      );
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
