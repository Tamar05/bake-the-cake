// Shared option lists for the request form and the baker notification settings.
//
// These VALUES are the canonical, language-independent identifiers that get
// stored in the database and compared during relevance matching, so a
// Hebrew-speaking requester and an English-speaking baker still match. The UI
// shows a per-language LABEL for each value (see the i18n `options` maps); the
// value itself is the English text and doubles as the fallback label for
// anything not in those maps (legacy free text, "Other").
//
// KEEP IN SYNC with src/lib/options.ts (the client copy) — the two are
// identical and their equality is enforced by options.test.ts. This file must
// stay a pure constants module: never add an import to it.

// Delivery areas. The request form's old free-text location becomes this
// dropdown; the requester still gives a phone for the exact address.
export const AREAS = [
  'Jerusalem',
  'Tel Aviv',
  'Haifa',
  'Rishon LeZion',
  'Petah Tikva',
  'Ashdod',
  'Netanya',
  'Beer Sheva',
  'Holon',
  'Ramat Gan',
  'Bnei Brak',
  'Rehovot',
  'Beit Shemesh',
  'Herzliya',
  'Kfar Saba',
  'Modiin',
  'Nazareth',
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

// Splits a stored joined string back into its parts. Tolerates any spacing and
// drops blanks, so legacy free-text values survive too.
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
