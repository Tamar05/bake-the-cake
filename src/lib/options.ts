// Shared option lists for the request form and the baker notification settings.
//
// These VALUES are the canonical, language-independent identifiers that get
// stored in the database and compared during relevance matching, so a
// Hebrew-speaking requester and an English-speaking baker still match. The UI
// shows a per-language LABEL for each value (see the i18n `options` maps); the
// value itself is the English text and doubles as the fallback label for
// anything not in those maps (legacy free text, "Other").
//
// KEEP IN SYNC with server/src/options.ts (the server copy) — the two are
// identical and their equality is enforced by server/src/options.test.ts. This
// file must stay a pure constants module: never add an import to it.

// The old Beit-Shemesh-only delivery-area list (AREAS) was replaced in Phase 5
// by a nationwide town list — see towns.ts. Location values are now a real
// town name, or "Other: <free text>" for one not yet in the list.

// Dietary needs. A request can have several (multi-select); a baker sets which
// ones they can accommodate.
export const DIETARY_OPTIONS = [
  'nut-free',
  'gluten-free',
  'dairy-free',
  'vegan',
  'vegetarian',
  'egg-free',
  'sugar-free',
  'Other',
] as const;

// Kashrut (הכשר) certification levels. A request picks the one level it needs;
// a baker sets every level they can provide.
export const KASHRUT_OPTIONS = [
  'Rabbanut',
  'Rabbanut Mehadrin',
  'Badatz Eda Haredit',
  'Badatz Beit Yosef',
  'Badatz Chatam Sofer',
  'Kosher (no specific hechsher)',
  'Not required',
] as const;

// The multi-value request fields (dietary needs, and the acceptable kashrut
// levels) are each stored as ONE string joined with this separator, keeping the
// existing `dietary` / `kashrut` text columns (no schema change). Always go
// through joinList/parseList so the form, the card, and the relevance matcher
// agree on the encoding.
export const LIST_SEPARATOR = ', ';

export function joinList(values: readonly string[]): string {
  return values.join(LIST_SEPARATOR);
}

// Keeps only the values still present in a current option list, preserving the
// input order. Used when loading a baker's saved capabilities: a value from an
// option that has since been removed (e.g. an old delivery area) is dropped
// rather than kept and silently re-submitted — where the server's strict
// validation would otherwise reject the whole save. This keeps the settings
// form self-healing across any future change to these lists. Pass
// OTHER_TEXT_PREFIX as `otherPrefix` for a list (like dietary) whose "Other"
// option may carry attached free text, so a saved "Other: <text>" survives too.
export function knownOnly(
  values: readonly string[],
  allowed: readonly string[],
  otherPrefix?: string,
): string[] {
  return values.filter((value) => allowed.includes(value) || (otherPrefix != null && value.startsWith(otherPrefix)));
}

// Splits a stored joined string back into its parts. Tolerates any spacing and
// drops blanks, so legacy free-text values survive too.
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

// The "Other" dietary checkbox doubles as a free-text escape hatch (same
// pattern as OTHER_PREFIX for towns in towns.ts): checking it stores the plain
// value below; typing into the free-text box that appears re-stores it with
// this prefix instead. The server accepts either form but never matches a
// free-text entry during relevance matching (an exact-string comparison would
// almost never agree between two independently typed notes anyway).
export const OTHER_OPTION = 'Other';
export const OTHER_TEXT_PREFIX = 'Other: ';

// True once "Other" is checked, whether or not free text has been typed yet.
export function hasOtherSelected(values: readonly string[]): boolean {
  return values.some((v) => v === OTHER_OPTION || v.startsWith(OTHER_TEXT_PREFIX));
}

// The free text after "Other: ", or '' when Other isn't selected or has no
// text yet.
export function otherFreeText(values: readonly string[]): string {
  const entry = values.find((v) => v.startsWith(OTHER_TEXT_PREFIX));
  return entry ? entry.slice(OTHER_TEXT_PREFIX.length) : '';
}

// Toggles a checkbox value in or out of `values`. "Other" gets special
// handling so unchecking it removes its entry whether or not free text is
// attached ("Other" or "Other: <text>"); every other value is a plain in/out
// toggle.
export function toggleOption(values: readonly string[], value: string): string[] {
  if (value === OTHER_OPTION) {
    return hasOtherSelected(values)
      ? values.filter((v) => v !== OTHER_OPTION && !v.startsWith(OTHER_TEXT_PREFIX))
      : [...values, OTHER_OPTION];
  }
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

// Attaches (or clears) the free text typed under an already-checked "Other".
export function setOtherFreeText(values: readonly string[], text: string): string[] {
  const rest = values.filter((v) => v !== OTHER_OPTION && !v.startsWith(OTHER_TEXT_PREFIX));
  const trimmed = text.trim();
  return [...rest, trimmed ? OTHER_TEXT_PREFIX + trimmed : OTHER_OPTION];
}
