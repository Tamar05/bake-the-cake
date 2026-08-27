import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import type { RequestDraft } from '../types';
import { findMissingFields } from '../lib/requests';
import { isValidPhone } from '../lib/phone';
import {
  AREAS,
  DIETARY_OPTIONS,
  KASHRUT_OPTIONS,
  joinDietary,
  parseDietary,
} from '../lib/options';
import { optionLabel } from '../lib/optionLabels';

const EMPTY_DRAFT: RequestDraft = {
  recipient: '',
  occasion: '',
  neededBy: '',
  dietary: '',
  location: '',
  kashrut: '',
  aboutRecipient: '',
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

  // Dietary is a multi-select stored as one joined string; toggle a value in or
  // out and re-join, so the rest of the app sees the same encoding.
  const chosenDietary = parseDietary(draft.dietary);
  function toggleDietary(option: string) {
    const next = chosenDietary.includes(option)
      ? chosenDietary.filter((d) => d !== option)
      : [...chosenDietary, option];
    update('dietary', joinDietary(next));
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
        {t.form.locationLabel}
        <select value={draft.location} onChange={(e) => update('location', e.target.value)}>
          <option value="">{t.form.selectPlaceholder}</option>
          {AREAS.map((area) => (
            <option key={area} value={area}>
              {optionLabel(t.options.area, area)}
            </option>
          ))}
        </select>
      </label>

      <label>
        {t.form.kashrutLabel}
        <select value={draft.kashrut} onChange={(e) => update('kashrut', e.target.value)}>
          <option value="">{t.form.selectPlaceholder}</option>
          {KASHRUT_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {optionLabel(t.options.kashrut, level)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="options-fieldset">
        <legend>{t.form.dietaryLabel}</legend>
        {DIETARY_OPTIONS.map((option) => (
          <label key={option} className="checkbox-option">
            <input
              type="checkbox"
              checked={chosenDietary.includes(option)}
              onChange={() => toggleDietary(option)}
            />
            {optionLabel(t.options.dietary, option)}
          </label>
        ))}
      </fieldset>

      <label>
        {t.form.aboutRecipientLabel}
        <textarea
          value={draft.aboutRecipient}
          maxLength={500}
          rows={3}
          onChange={(e) => update('aboutRecipient', e.target.value)}
        />
        <small>{t.form.aboutRecipientHint}</small>
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
