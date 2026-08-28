import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import type { RequestDraft } from '../types';
import { findMissingFields } from '../lib/requests';
import { isValidPhone } from '../lib/phone';
import { AREAS, DIETARY_OPTIONS, KASHRUT_OPTIONS, joinList, parseList } from '../lib/options';
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
  onSubmit: (draft: RequestDraft) => void;
  initial?: RequestDraft; // pre-fill for editing; omitted → a blank create form
  submitLabel?: string; // defaults to the "Submit request" label
  onCancel?: () => void; // when set (edit mode), shows a Cancel button + hides the heading
};

// Which validation message (if any) to show under the form.
type FormError = null | 'missing' | 'phone';

// Used for creating a new request, and — pre-filled via `initial` — for editing
// an existing one. In edit mode (`onCancel` set) it hides the big heading and
// shows a Cancel button, and it does not blank itself after submitting.
export default function RequestForm({ t, onSubmit, initial, submitLabel, onCancel }: Props) {
  const [draft, setDraft] = useState<RequestDraft>(initial ?? EMPTY_DRAFT);
  const [error, setError] = useState<FormError>(null);
  const isEditing = onCancel != null;

  function update(field: keyof RequestDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  // Dietary needs and acceptable kashrut levels are both multi-select, each
  // stored as one joined string; toggle a value in or out and re-join so the
  // rest of the app sees the same encoding.
  const chosenDietary = parseList(draft.dietary);
  const chosenKashrut = parseList(draft.kashrut);
  function toggleListValue(field: 'dietary' | 'kashrut', option: string) {
    const current = parseList(draft[field]);
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    update(field, joinList(next));
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
    onSubmit(draft);
    if (!isEditing) setDraft(EMPTY_DRAFT); // create mode clears; edit mode is unmounted by its parent
    setError(null);
  }

  return (
    <form className="request-form" onSubmit={handleSubmit}>
      {!isEditing && <h2>{t.form.heading}</h2>}

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

      <fieldset className="options-fieldset">
        <legend>{t.form.kashrutLabel}</legend>
        {KASHRUT_OPTIONS.map((level) => (
          <label key={level} className="checkbox-option">
            <input
              type="checkbox"
              checked={chosenKashrut.includes(level)}
              onChange={() => toggleListValue('kashrut', level)}
            />
            {optionLabel(t.options.kashrut, level)}
          </label>
        ))}
      </fieldset>

      <fieldset className="options-fieldset">
        <legend>{t.form.dietaryLabel}</legend>
        {DIETARY_OPTIONS.map((option) => (
          <label key={option} className="checkbox-option">
            <input
              type="checkbox"
              checked={chosenDietary.includes(option)}
              onChange={() => toggleListValue('dietary', option)}
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

      <div className="form-actions">
        <button type="submit">{submitLabel ?? t.form.submit}</button>
        {onCancel && (
          <button type="button" className="auth-link" onClick={onCancel}>
            {t.form.cancelEdit}
          </button>
        )}
      </div>
    </form>
  );
}
