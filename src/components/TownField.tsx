import { useId, useState, useEffect } from 'react';
import { TOWNS, OTHER_PREFIX, findTown, type Town } from '../lib/towns';
import type { Language } from '../i18n/language';

type Props = {
  label: string;
  value: string; // the raw stored value: a real town name, "Other: <text>", or ''
  onChange: (value: string) => void;
  hint?: string;
  language: Language;
};

// A Hebrew-name lookup alongside towns.ts's own English-name one (findTown),
// so typing or picking a town's Hebrew label resolves back to the same
// canonical (English) Town record that gets stored and sent to the server.
const BY_HEBREW_NAME = new Map(TOWNS.filter((t) => t.nameHe).map((t) => [t.nameHe as string, t]));

// The label to show for a known town: its Hebrew name while the form is in
// Hebrew (falling back to English for the handful still missing one), and its
// English name otherwise.
function displayName(town: Town, language: Language): string {
  return language === 'he' && town.nameHe ? town.nameHe : town.name;
}

// A searchable town picker (Phase 5): a plain text input backed by a native
// <datalist> of every known town — no extra dependency, keyboard/screen-reader
// friendly. The list (and what you can type to match it) follows the form's
// current language, so a Hebrew-speaking requester can find their town by its
// Hebrew name too. Typing something that isn't in the list is accepted as-is
// and stored with the "Other: " prefix (buildRequestDraft/parseNotificationPrefs
// on the server validate the same way), so there's no separate "I can't find
// my town" toggle — it just works either way.
export default function TownField({ label, value, onChange, hint, language }: Props) {
  const listId = useId();
  const stripPrefix = (v: string) => (v.startsWith(OTHER_PREFIX) ? v.slice(OTHER_PREFIX.length) : v);

  // Shows a known town's name in whichever language the form is currently in;
  // a free-text "Other" entry is shown exactly as typed, in either language.
  function toDisplay(v: string): string {
    const raw = stripPrefix(v);
    const known = findTown(raw);
    return known ? displayName(known, language) : raw;
  }

  const [display, setDisplay] = useState(() => toDisplay(value));

  // Keep the shown text in sync if the value changes from outside (e.g. once
  // a baker's saved settings finish loading), or if the language toggle flips
  // while a known town is already chosen.
  useEffect(() => {
    setDisplay(toDisplay(value));
    // toDisplay is stable in behavior for a given value+language pair — only
    // those two need to re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, language]);

  function handleChange(next: string) {
    setDisplay(next);
    const trimmed = next.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }
    const known = findTown(trimmed) ?? BY_HEBREW_NAME.get(trimmed);
    onChange(known ? known.name : OTHER_PREFIX + trimmed);
  }

  return (
    <label>
      {label}
      <input list={listId} value={display} onChange={(e) => handleChange(e.target.value)} />
      <datalist id={listId}>
        {TOWNS.map((t) => (
          <option key={t.name} value={displayName(t, language)} />
        ))}
      </datalist>
      {hint && <small>{hint}</small>}
    </label>
  );
}
