// Splits a free-text ingredient line ("400g mouky", "2 lžíce hladké mouky")
// into amount/unit/name so several recipes' ingredients can be combined into
// one shopping list. The raw string stays the only thing ever stored or
// edited (see app/components/RecipeForm.vue) — this parses it on demand,
// purely in memory, each time a shopping list is built. Nothing here is
// persisted, matching the app's existing shopping-mode philosophy that
// shopping-related state is derived and disposable (see the non-persisted
// checked-ingredient Set in app/components/RecipeCard.vue).
//
// Grouping is intentionally conservative: only an exact match on the
// normalized ingredient name (after the amount+unit prefix is stripped)
// combines two lines. No stemming/fuzzy merge, to avoid wrongly combining
// e.g. "rajčatový protlak" with "rajčata" — shared/utils/czech-stem.ts is a
// plausible fuzzy-grouping upgrade later, not used here.

export type IngredientKind = 'mass' | 'volume' | 'count' | 'unknown'

export interface ParsedIngredient {
  raw: string
  amount: number | null
  unit: string | null
  name: string
  kind: IngredientKind
  // Amount converted to grams (mass) or millilitres (volume); null for
  // 'count'/'unknown', which can't be cross-unit-converted.
  baseAmount: number | null
}

export interface AggregatedIngredientSource {
  recipeId: number
  recipeName: string
  raw: string
}

export interface AggregatedIngredient {
  key: string
  name: string
  kind: IngredientKind
  // A combined, formatted total ("1.4 kg", "5 ks", "3 cibule"), or null when
  // the group can't be numerically combined (no amount, e.g. "sůl podle
  // chuti") — the caller falls back to listing raw per-recipe lines.
  displayQuantity: string | null
  sources: AggregatedIngredientSource[]
}

// Mass and volume convert across units (g/dkg/kg, ml/dl/l) and sum freely.
// Count-type units (ks, lžíce, stroužek, ...) are recognised so the amount
// can still be split off the name, but are only summed when the unit string
// matches exactly — a spoon can't be converted into a clove.
//
// Forms are hand-enumerated per unit (covering the common singular/plural
// case endings, e.g. instrumental "lžícemi", locative "kilogramech") rather
// than matched through shared/utils/czech-stem.ts's declension stemmer:
// that stemmer is tuned for fuzzy-matching whole free-text search terms,
// and applying it to this fixed, tiny vocabulary risks a stem collision
// pulling in an unrelated word as a false-positive unit. An unlisted
// inflection still degrades safely — the line just keeps its unit word as
// part of the name instead of being recognised as a unit, rather than
// merging incorrectly.
const UNIT_TABLE: Record<string, { key: string; kind: 'mass' | 'volume' | 'count'; factor?: number }> = {
  g: { key: 'g', kind: 'mass', factor: 1 },
  gram: { key: 'g', kind: 'mass', factor: 1 },
  gramu: { key: 'g', kind: 'mass', factor: 1 },
  gramy: { key: 'g', kind: 'mass', factor: 1 },
  gramů: { key: 'g', kind: 'mass', factor: 1 },
  gramech: { key: 'g', kind: 'mass', factor: 1 },
  gramem: { key: 'g', kind: 'mass', factor: 1 },
  dkg: { key: 'dkg', kind: 'mass', factor: 10 },
  dag: { key: 'dkg', kind: 'mass', factor: 10 },
  deko: { key: 'dkg', kind: 'mass', factor: 10 },
  deka: { key: 'dkg', kind: 'mass', factor: 10 },
  dek: { key: 'dkg', kind: 'mass', factor: 10 },
  kg: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogram: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogramu: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogramy: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogramů: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogramech: { key: 'kg', kind: 'mass', factor: 1000 },
  kilogramem: { key: 'kg', kind: 'mass', factor: 1000 },
  ml: { key: 'ml', kind: 'volume', factor: 1 },
  mililitr: { key: 'ml', kind: 'volume', factor: 1 },
  mililitru: { key: 'ml', kind: 'volume', factor: 1 },
  mililitry: { key: 'ml', kind: 'volume', factor: 1 },
  mililitrů: { key: 'ml', kind: 'volume', factor: 1 },
  mililitrech: { key: 'ml', kind: 'volume', factor: 1 },
  dl: { key: 'dl', kind: 'volume', factor: 100 },
  decilitr: { key: 'dl', kind: 'volume', factor: 100 },
  decilitru: { key: 'dl', kind: 'volume', factor: 100 },
  decilitry: { key: 'dl', kind: 'volume', factor: 100 },
  decilitrů: { key: 'dl', kind: 'volume', factor: 100 },
  decilitrech: { key: 'dl', kind: 'volume', factor: 100 },
  l: { key: 'l', kind: 'volume', factor: 1000 },
  litr: { key: 'l', kind: 'volume', factor: 1000 },
  litru: { key: 'l', kind: 'volume', factor: 1000 },
  litry: { key: 'l', kind: 'volume', factor: 1000 },
  litrů: { key: 'l', kind: 'volume', factor: 1000 },
  litrech: { key: 'l', kind: 'volume', factor: 1000 },
  litrem: { key: 'l', kind: 'volume', factor: 1000 },
  ks: { key: 'ks', kind: 'count' },
  kus: { key: 'ks', kind: 'count' },
  kusu: { key: 'ks', kind: 'count' },
  kusy: { key: 'ks', kind: 'count' },
  kusů: { key: 'ks', kind: 'count' },
  kusech: { key: 'ks', kind: 'count' },
  kusem: { key: 'ks', kind: 'count' },
  lzice: { key: 'lžíce', kind: 'count' },
  lzici: { key: 'lžíce', kind: 'count' },
  lzic: { key: 'lžíce', kind: 'count' },
  lzicim: { key: 'lžíce', kind: 'count' },
  lzicich: { key: 'lžíce', kind: 'count' },
  lzicemi: { key: 'lžíce', kind: 'count' },
  lzicka: { key: 'lžička', kind: 'count' },
  lzicku: { key: 'lžička', kind: 'count' },
  lzicek: { key: 'lžička', kind: 'count' },
  lzickam: { key: 'lžička', kind: 'count' },
  lzickach: { key: 'lžička', kind: 'count' },
  lzickami: { key: 'lžička', kind: 'count' },
  strouzek: { key: 'stroužek', kind: 'count' },
  strouzku: { key: 'stroužek', kind: 'count' },
  strouzky: { key: 'stroužek', kind: 'count' },
  strouzkem: { key: 'stroužek', kind: 'count' },
  strouzcich: { key: 'stroužek', kind: 'count' },
  platek: { key: 'plátek', kind: 'count' },
  platku: { key: 'plátek', kind: 'count' },
  platky: { key: 'plátek', kind: 'count' },
  platkem: { key: 'plátek', kind: 'count' },
  platcich: { key: 'plátek', kind: 'count' },
  snitka: { key: 'snítka', kind: 'count' },
  snitky: { key: 'snítka', kind: 'count' },
  snitek: { key: 'snítka', kind: 'count' },
  snitkou: { key: 'snítka', kind: 'count' },
  snitkach: { key: 'snítka', kind: 'count' },
  hrst: { key: 'hrst', kind: 'count' },
  hrsti: { key: 'hrst', kind: 'count' },
  hrstmi: { key: 'hrst', kind: 'count' },
  spetka: { key: 'špetka', kind: 'count' },
  spetky: { key: 'špetka', kind: 'count' },
  spetek: { key: 'špetka', kind: 'count' },
  spetkou: { key: 'špetka', kind: 'count' },
  spetkach: { key: 'špetka', kind: 'count' },
  baleni: { key: 'balení', kind: 'count' },
  baleniho: { key: 'balení', kind: 'count' },
  balenim: { key: 'balení', kind: 'count' },
  balenich: { key: 'balení', kind: 'count' },
  svazek: { key: 'svazek', kind: 'count' },
  svazku: { key: 'svazek', kind: 'count' },
  svazky: { key: 'svazek', kind: 'count' },
  svazkem: { key: 'svazek', kind: 'count' },
  svazcich: { key: 'svazek', kind: 'count' },
  sklenice: { key: 'sklenice', kind: 'count' },
  sklenic: { key: 'sklenice', kind: 'count' },
  sklenici: { key: 'sklenice', kind: 'count' },
  sklenicich: { key: 'sklenice', kind: 'count' },
  konzerva: { key: 'konzerva', kind: 'count' },
  konzervy: { key: 'konzerva', kind: 'count' },
  konzerv: { key: 'konzerva', kind: 'count' },
  konzervou: { key: 'konzerva', kind: 'count' },
  konzervach: { key: 'konzerva', kind: 'count' },
  hrnek: { key: 'hrnek', kind: 'count' },
  hrnku: { key: 'hrnek', kind: 'count' },
  hrnky: { key: 'hrnek', kind: 'count' },
  hrnkem: { key: 'hrnek', kind: 'count' },
  hrncich: { key: 'hrnek', kind: 'count' },
}

// A leading number: a simple fraction ("1/2"), a decimal using either a dot
// or the Czech comma ("1,5"), or a plain integer, optionally followed by a
// "2-3" style range — only the first (lower) value of a range is used.
const NUMBER_RE = /^(\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(?:\d+\/\d+|\d+(?:[.,]\d+)?))?/

function parseAmountToken(token: string): number {
  if (token.includes('/')) {
    const [num, den] = token.split('/').map(Number)
    return num! / den!
  }
  return Number.parseFloat(token.replace(',', '.'))
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function formatNumber(n: number): string {
  return String(Math.round(n * 10) / 10)
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  const trimmed = raw.trim()
  const numberMatch = NUMBER_RE.exec(trimmed)

  if (!numberMatch) {
    return { raw, amount: null, unit: null, name: normalizeIngredientName(trimmed), kind: 'unknown', baseAmount: null }
  }

  const amount = parseAmountToken(numberMatch[1]!)
  const rest = trimmed.slice(numberMatch[0].length).trim()
  const wordMatch = /^(\p{L}+)/u.exec(rest)
  const unitInfo = wordMatch ? UNIT_TABLE[stripDiacritics(wordMatch[1]!.toLowerCase())] : undefined

  if (!unitInfo) {
    return { raw, amount, unit: null, name: normalizeIngredientName(rest), kind: 'count', baseAmount: null }
  }

  const name = normalizeIngredientName(rest.slice(wordMatch![1]!.length))
  // Nothing follows the unit word (a malformed line, e.g. just "400 g") —
  // treat the whole remainder as the name instead of the unit, rather than
  // producing an entry with an empty name.
  if (!name) {
    return { raw, amount, unit: null, name: normalizeIngredientName(rest), kind: 'count', baseAmount: null }
  }
  if (unitInfo.kind === 'mass' || unitInfo.kind === 'volume') {
    return { raw, amount, unit: unitInfo.key, name, kind: unitInfo.kind, baseAmount: amount * unitInfo.factor! }
  }
  return { raw, amount, unit: unitInfo.key, name, kind: 'count', baseAmount: null }
}

export function formatQuantity(baseAmount: number, kind: 'mass' | 'volume'): string {
  if (kind === 'mass') {
    return baseAmount >= 1000 ? `${formatNumber(baseAmount / 1000)} kg` : `${formatNumber(baseAmount)} g`
  }
  return baseAmount >= 1000 ? `${formatNumber(baseAmount / 1000)} l` : `${formatNumber(baseAmount)} ml`
}

// 'unknown' (no amount at all, e.g. "sůl podle chuti") and 'count' with no
// unit word (a bare noun with a number, e.g. "2 citron") are grouped
// together as one "text" family keyed by name+unit: the same ingredient is
// often written both ways across different recipes ("sůl" in one, "1 sůl"
// in another), and keying by kind as well as name used to keep those in
// separate groups — defeating the point of combining them. Whether the
// merged group ends up "unknown" or "count" is decided once every line has
// been folded in (see hasUnknownAmount below), not from a single line's own
// kind.
interface Group {
  name: string
  family: 'mass' | 'volume' | 'text'
  unit: string | null
  totalBase: number
  totalAmount: number
  hasUnknownAmount: boolean
  sources: AggregatedIngredientSource[]
}

function groupKey(parsed: ParsedIngredient): string {
  if (parsed.kind === 'mass' || parsed.kind === 'volume') return `${parsed.kind}:${parsed.name}`
  return `text:${parsed.name}:${parsed.unit ?? ''}`
}

export function aggregateIngredients(
  recipes: { id: number; name: string; ingredients: string[] }[],
): AggregatedIngredient[] {
  const groups = new Map<string, Group>()

  for (const recipe of recipes) {
    for (const line of recipe.ingredients) {
      if (!line.trim()) continue
      const parsed = parseIngredientLine(line)
      const key = groupKey(parsed)

      const group = groups.get(key) ?? {
        name: parsed.name,
        family: parsed.kind === 'mass' || parsed.kind === 'volume' ? parsed.kind : 'text',
        unit: parsed.unit,
        totalBase: 0,
        totalAmount: 0,
        hasUnknownAmount: false,
        sources: [],
      }
      if (parsed.baseAmount !== null) group.totalBase += parsed.baseAmount
      if (parsed.amount !== null) group.totalAmount += parsed.amount
      else group.hasUnknownAmount = true
      group.sources.push({ recipeId: recipe.id, recipeName: recipe.name, raw: parsed.raw })
      groups.set(key, group)
    }
  }

  return [...groups.entries()].map(([key, group]) => {
    if (group.family === 'mass' || group.family === 'volume') {
      return {
        key,
        name: group.name,
        kind: group.family,
        displayQuantity: formatQuantity(group.totalBase, group.family),
        sources: group.sources,
      }
    }
    // A number wasn't found on every line for this ingredient, so there's no
    // total that's safe to show — e.g. "citron" plus "2 citron" can't
    // confidently be reported as "citron" and "2 citron" that sum to 3.
    if (group.hasUnknownAmount) {
      return { key, name: group.name, kind: 'unknown' as const, displayQuantity: null, sources: group.sources }
    }
    const displayQuantity = group.unit
      ? `${formatNumber(group.totalAmount)} ${group.unit} ${group.name}`
      : `${formatNumber(group.totalAmount)} ${group.name}`
    return { key, name: group.name, kind: 'count' as const, displayQuantity, sources: group.sources }
  })
}
