import { OTHER_PREFIX } from './towns';

// Localized display label for a stored option value. The database keeps the
// canonical (English) value; this looks up the reader's-language label for it,
// falling back to the raw value for anything not in the map — legacy free text,
// and defensively for unknown values.
export function optionLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

// Display form of a stored town/location value (Phase 5): a real town name
// shows as-is; the "Other: <text>" escape hatch shows just the typed text,
// without the internal storage prefix leaking into the UI.
export function townLabel(value: string): string {
  return value.startsWith(OTHER_PREFIX) ? value.slice(OTHER_PREFIX.length) : value;
}
