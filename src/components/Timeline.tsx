import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';

// A compact "compassion timeline": the cake's journey with the date of each step
// it has reached (steps not yet reached show greyed with no date). Shown once a
// baker has committed to bake, through to received.
export default function Timeline({
  t,
  language,
  request,
}: {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
}) {
  const steps: { label: string; at: number | null }[] = [
    { label: t.timeline.posted, at: request.createdAt },
    { label: t.timeline.reserved, at: request.reservedAt },
    { label: t.timeline.baking, at: request.committedAt },
    { label: t.timeline.delivered, at: request.deliveredAt },
    { label: t.timeline.received, at: request.receivedAt },
  ];
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  return (
    <div className="timeline">
      <h4 className="timeline-heading">{t.timeline.heading}</h4>
      <ol className="timeline-steps">
        {steps.map((step) => (
          <li key={step.label} className={step.at != null ? 'done' : 'pending'}>
            <span className="timeline-dot" aria-hidden />
            <span className="timeline-label">{step.label}</span>
            {step.at != null && <span className="timeline-date">{fmt(step.at)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
