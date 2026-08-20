import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import type { RequestDraft } from '../types';
import { findMissingFields } from '../lib/requests';

const EMPTY_DRAFT: RequestDraft = {
  recipient: '',
  occasion: '',
  neededBy: '',
  dietary: '',
  location: '',
};

type Props = {
  t: Dictionary;
  onAdd: (draft: RequestDraft) => void;
};

export default function RequestForm({ t, onAdd }: Props) {
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_DRAFT);
  const [showError, setShowError] = useState(false);

  function update(field: keyof RequestDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (findMissingFields(draft).length > 0) {
      setShowError(true);
      return;
    }
    onAdd(draft);
    setDraft(EMPTY_DRAFT);
    setShowError(false);
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

      {showError && <p className="form-error">{t.form.missingFields}</p>}

      <button type="submit">{t.form.submit}</button>
    </form>
  );
}
