import { useState } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import { en } from './i18n/en';
import { createRequest } from './lib/requests';
import type { CakeRequest, RequestDraft } from './types';

export default function App() {
  const t = en; // Slice 1.5 will let this switch between en and he.
  const [requests, setRequests] = useState<CakeRequest[]>([]);

  function handleAdd(draft: RequestDraft) {
    const request = createRequest(draft);
    setRequests((prev) => [request, ...prev]); // newest first
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
      </header>
      <RequestForm t={t} onAdd={handleAdd} />
      <RequestList t={t} requests={requests} />
    </main>
  );
}
