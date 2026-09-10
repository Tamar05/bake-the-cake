import { useId, useState, useEffect } from 'react';
import { TOWNS, OTHER_PREFIX, findTown } from '../lib/towns';

type Props = {
  label: string;
  value: string; // the raw stored value: a real town name, "Other: <text>", or ''
  onChange: (value: string) => void;
  hint?: string;
};

// A searchable town picker (Phase 5): a plain text input backed by a native
// <datalist> of every known town — no extra dependency, keyboard/screen-reader
// friendly. Typing something that isn't in the list is accepted as-is and
// stored with the "Other: " prefix (buildRequestDraft/parseNotificationPrefs
// on the server validate the same way), so there's no separate "I can't find
// my town" toggle — it just works either way.
export default function TownField({ label, value, onChange, hint }: Props) {
  const listId = useId();
  const stripPrefix = (v: string) => (v.startsWith(OTHER_PREFIX) ? v.slice(OTHER_PREFIX.length) : v);
  const [display, setDisplay] = useState(stripPrefix(value));

  // Keep the shown text in sync if the value changes from outside (e.g. once
  // a baker's saved settings finish loading).
  useEffect(() => {
    setDisplay(stripPrefix(value));
  }, [value]);

  function handleChange(next: string) {
    setDisplay(next);
    const trimmed = next.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }
    const known = findTown(trimmed);
    onChange(known ? known.name : OTHER_PREFIX + trimmed);
  }

  return (
    <label>
      {label}
      <input list={listId} value={display} onChange={(e) => handleChange(e.target.value)} />
      <datalist id={listId}>
        {TOWNS.map((t) => (
          <option key={t.name} value={t.name} />
        ))}
      </datalist>
      {hint && <small>{hint}</small>}
    </label>
  );
}
