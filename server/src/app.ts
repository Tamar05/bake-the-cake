import express from 'express';
import cors from 'cors';
import { ALREADY_RESERVED, NOT_RESERVER, type RequestsStore } from './requestsStore';
import type { Translator } from './translator';
import type { CakeRequest, RequestDraft } from './types';
import {
  createSupabaseAuthenticator,
  requireAuth,
  requireRole,
  optionalAuth,
  type Authenticator,
  type AuthedRequest,
  type AuthedProfile,
} from './auth';

// The required fields a new request must include.
function isMissingRequired(draft: Partial<RequestDraft>): boolean {
  return !draft.recipient || !draft.occasion || !draft.neededBy || !draft.location;
}

// A reserved request only reveals who reserved it (name + contact + their id) to
// the baker who reserved it, the requester who posted it, or an admin. Everyone
// else — including anonymous browsers — sees a plain reserved card.
function redactReserver(request: CakeRequest, viewer: AuthedProfile | undefined): CakeRequest {
  if (request.status !== 'reserved') return request;
  const maySee =
    viewer != null &&
    (viewer.role === 'admin' ||
      viewer.id === request.reservedByUserId ||
      viewer.id === request.ownerId);
  if (maySee) return request;
  return { ...request, reservedBy: null, reservedContact: null, reservedByUserId: null };
}

// Builds the Express app around a store (real Supabase store in production,
// an in-memory fake in tests).
export function createApp(
  store: RequestsStore,
  translator: Translator,
  authenticator: Authenticator = createSupabaseAuthenticator(),
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

  app.post('/api/requests/:id/reserve', auth, requireRole('baker', 'admin'), async (req, res) => {
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
      res.status(500).json({ error: 'Could not release this request' });
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
