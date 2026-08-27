// Localized display label for a stored option value. The database keeps the
// canonical (English) value; this looks up the reader's-language label for it,
// falling back to the raw value for anything not in the map — legacy free text,
// and defensively for unknown values.
export function optionLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}
