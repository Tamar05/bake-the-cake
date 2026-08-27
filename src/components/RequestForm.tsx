import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import type { RequestDraft } from '../types';
import { findMissingFields } from '../lib/requests';
import { isValidPhone } from '../lib/phone';

const EMPTY_DRAFT: RequestDraft = {
  recipient: '',
  occasion: '',
  neededBy: '',
  dietary: '',
  location: '',
  contactPhone: '',
};

type Props = {
  t: Dictionary;
  onAdd: (draft: RequestDraft) => void;
};

// Which validation message (if any) to show under the form.
type FormError = null | 'missing' | 'phone';

export default function RequestForm({ t, onAdd }: Props) {
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<FormError>(null);

  function update(field: keyof RequestDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Blank required fields first, then the phone must be a real number.
    if (findMissingFields(draft).length > 0) {
      setError('missing');
      return;
    }
    if (!isValidPhone(draft.contactPhone)) {
      setError('phone');
      return;
    }
    onAdd(draft);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  return (
    <form className="request-form" onSubmit={handleSubmit}>
      <h2>{t.form.heading}</h2>

      <label>
        {t.form.recipientLabel}
        <input value={draft.recipient} onChange={(e) => update('recipient', e.target.value)} />
      </label>

      <label>
        {t.form.occasionLabel}
        <input value={draft.occasion} onChange={(e) => update('occasion', e.target.value)} />
      </label>

      <label>
        {t.form.neededByLabel}
        <input type="date" value={draft.neededBy} onChange={(e) => update('neededBy', e.target.value)} />
      </label>

      <label>
        {t.form.dietaryLabel}
        <input value={draft.dietary} onChange={(e) => update('dietary', e.target.value)} />
      </label>

      <label>
        {t.form.locationLabel}
        <input value={draft.location} onChange={(e) => update('location', e.target.value)} />
      </label>

      <label>
        {t.form.contactPhoneLabel}
        <input
          type="tel"
          inputMode="tel"
          value={draft.contactPhone}
          onChange={(e) => update('contactPhone', e.target.value)}
        />
        <small>{t.form.contactPhoneHint}</small>
      </label>

      {error === 'missing' && <p className="form-error">{t.form.missingFields}</p>}
      {error === 'phone' && <p className="form-error">{t.form.invalidPhone}</p>}

      <button type="submit">{t.form.submit}</button>
    </form>
  );
}
