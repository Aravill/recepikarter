// Parses the free-text search box into an optional field key plus the
// term to fuzzy-match. Without a recognised "key:" prefix the term is
// matched against every searchable field; with one, matching is restricted
// to that field ("author:admin", "tag:meal prep", "ingredient:carrot").
// English keys are canonical; the Czech aliases exist because the UI copy
// is Czech and typing "autor:" is what the placeholder suggests.

export const SEARCH_KEYS = ['name', 'ingredient', 'tag', 'author'] as const

export type SearchKey = (typeof SEARCH_KEYS)[number]

export const SEARCH_KEY_LABELS: Record<SearchKey, string> = {
  name: 'název',
  ingredient: 'ingredience',
  tag: 'tag',
  author: 'autor',
}

const KEY_ALIASES: Record<string, SearchKey> = {
  name: 'name',
  nazev: 'name',
  ingredient: 'ingredient',
  ingredients: 'ingredient',
  ingredience: 'ingredient',
  tag: 'tag',
  tags: 'tag',
  author: 'author',
  autor: 'author',
}

export interface ParsedSearchQuery {
  key: SearchKey | null
  term: string
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const trimmed = raw.trim()
  const match = /^([\p{L}]+)\s*:\s*(.*)$/su.exec(trimmed)
  if (match) {
    const key = KEY_ALIASES[stripDiacritics(match[1]!.toLowerCase())]
    if (key) return { key, term: match[2]!.trim() }
  }
  return { key: null, term: trimmed }
}
