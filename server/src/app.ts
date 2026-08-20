import express from 'express';
import cors from 'cors';

// Builds the Express app. Task 4 extends this to take a store and add the
// /api/requests endpoints.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
