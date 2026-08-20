import express from 'express';
import cors from 'cors';
import type { RequestsStore } from './requestsStore';
import type { RequestDraft } from './types';

// The required fields a new request must include.
function isMissingRequired(draft: Partial<RequestDraft>): boolean {
  return !draft.recipient || !draft.occasion || !draft.neededBy || !draft.location;
}

// Builds the Express app around a store (real Supabase store in production,
// an in-memory fake in tests).
export function createApp(store: RequestsStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/requests', async (_req, res) => {
    try {
      const requests = await store.listRequests();
      res.json(requests);
    } catch {
      res.status(500).json({ error: 'Could not load requests' });
    }
  });

  app.post('/api/requests', async (req, res) => {
    const draft = (req.body ?? {}) as Partial<RequestDraft>;
    if (isMissingRequired(draft)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    try {
      const saved = await store.addRequest({
        recipient: draft.recipient!,
        occasion: draft.occasion!,
        neededBy: draft.neededBy!,
        dietary: draft.dietary ?? '',
        location: draft.location!,
      });
      res.status(201).json(saved);
    } catch {
      res.status(500).json({ error: 'Could not save request' });
    }
  });

  return app;
}
