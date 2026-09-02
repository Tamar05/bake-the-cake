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

// Delivery areas — the Beit Shemesh neighborhoods this app serves. The request
// form's old free-text location is this dropdown; the requester still gives a
// phone for the exact address. The value is a stable English identifier; the
// Hebrew/English display label lives in the i18n `options.area` maps.
export const AREAS = [
  'Old Beit Shemesh',
  'Rama A',
  'Rama B',
  'Rama C',
  'Rama D',
  'Mishkafayim',
  'Neve Shamir',
  'Ramat Avraham',
  'Other',
] as const;

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
// form self-healing across any future change to these lists.
export function knownOnly(values: readonly string[], allowed: readonly string[]): string[] {
  return values.filter((value) => allowed.includes(value));
}

// Splits a stored joined string back into its parts. Tolerates any spacing and
// drops blanks, so legacy free-text values survive too.
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
