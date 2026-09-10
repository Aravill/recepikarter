// Used to decide whether two recipe names are "the same" for import
// duplicate-detection: case and diacritics shouldn't distinguish them any
// more than they do for the fuzzy search (see czech-stem.ts), so "Halusky",
// "halusky", and "Halušky" all normalize to the same key.
export function normalizeRecipeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
