import type { Dictionary } from '../i18n/types';
import type { CakeRequest } from '../types';

type Props = {
  t: Dictionary;
  requests: CakeRequest[];
};

export default function RequestList({ t, requests }: Props) {
  return (
    <section className="request-list">
      <h2>{t.list.heading}</h2>
      {requests.length === 0 ? (
        <p className="empty">{t.list.empty}</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id} className="request-card">
              <h3>{request.recipient}</h3>
              <p>{request.occasion}</p>
              <p>
                {t.list.neededByPrefix} {request.neededBy}
              </p>
              <p>
                {t.list.locationPrefix} {request.location}
              </p>
              {request.dietary && (
                <p>
                  {t.list.dietaryPrefix} {request.dietary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
