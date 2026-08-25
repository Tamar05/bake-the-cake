import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import RequestCard from './RequestCard';

type Props = {
  t: Dictionary;
  language: Language;
  requests: CakeRequest[];
  onUpdated: (updated: CakeRequest) => void;
};

export default function RequestList({ t, language, requests, onUpdated }: Props) {
  return (
    <section className="request-list">
      <h2>{t.list.heading}</h2>
      {requests.length === 0 ? (
        <p className="empty">{t.list.empty}</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              t={t}
              language={language}
              request={request}
              onUpdated={onUpdated}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
