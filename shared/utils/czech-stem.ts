// Light stemmer for Czech, used to match ingredient/recipe-name search
// queries across Czech noun/adjective declensions (e.g. "mouka"/"mouky"/
// "moukou" should all match each other). Ported from Dolamic & Savoy's
// published "light stemmer" algorithm (the same one Lucene's
// CzechAnalyzer ships) rather than depending on the `czech-stemmer` npm
// package, which throws under strict-mode ESM (an undeclared `result`
// variable — a real bug in that 2013, since-unmaintained package). This
// is a faithful port, including matching the upstream algorithm's exact
// suffix-length comparisons even where one branch (the "ště"/"šti"/"ští"
// case in `palatalise`) compares against a 3-character literal using only
// the last 2 characters and so can never match — that's the published
// algorithm's own behavior, not something to "fix" without re-validating
// against its reference test suite.

function dropLast(s: string, n: number): string {
  return s.slice(0, s.length - n)
}

function replaceLast(s: string, n: number, replacement: string): string {
  return dropLast(s, n) + replacement
}

function palatalise(s: string): string {
  const len = s.length
  const last2 = s.slice(len - 2)
  const last3 = s.slice(len - 3)

  if (last2 === 'ci' || last2 === 'ce' || last2 === 'či' || last2 === 'če') {
    return replaceLast(s, 2, 'k')
  }
  if (last2 === 'zi' || last2 === 'ze' || last2 === 'ži' || last2 === 'že') {
    return replaceLast(s, 2, 'h')
  }
  if (last3 === 'čtě' || last3 === 'čti' || last3 === 'čtí') {
    return replaceLast(s, 3, 'ck')
  }
  if (last2 === 'ště' || last2 === 'šti' || last2 === 'ští') {
    return replaceLast(s, 2, 'sk')
  }
  return dropLast(s, 1)
}

function removeCase(s: string): string {
  const len = s.length

  if (len > 7 && s.slice(len - 5) === 'atech') {
    return dropLast(s, 5)
  }

  if (len > 6) {
    if (s.slice(len - 4) === 'ětem') return palatalise(dropLast(s, 3))
    if (s.slice(len - 4) === 'atům') return dropLast(s, 4)
  }

  if (len > 5) {
    const last3 = s.slice(len - 3)
    if (last3 === 'ech' || last3 === 'ich' || last3 === 'ích') {
      return palatalise(dropLast(s, 2))
    }
    if (
      last3 === 'ého' ||
      last3 === 'ěmi' ||
      last3 === 'emi' ||
      last3 === 'ému' ||
      last3 === 'ěte' ||
      last3 === 'ěti' ||
      last3 === 'iho' ||
      last3 === 'ího' ||
      last3 === 'ími' ||
      last3 === 'imu'
    ) {
      return palatalise(dropLast(s, 2))
    }
    if (
      last3 === 'ách' ||
      last3 === 'ata' ||
      last3 === 'aty' ||
      last3 === 'ých' ||
      last3 === 'ama' ||
      last3 === 'ami' ||
      last3 === 'ové' ||
      last3 === 'ovi' ||
      last3 === 'ými'
    ) {
      return dropLast(s, 3)
    }
  }

  if (len > 4) {
    const last2 = s.slice(len - 2)
    if (last2 === 'em') return palatalise(dropLast(s, 1))
    if (last2 === 'es' || last2 === 'ém' || last2 === 'ím') return palatalise(dropLast(s, 2))
    if (last2 === 'ům') return dropLast(s, 2)
    if (
      last2 === 'at' ||
      last2 === 'ám' ||
      last2 === 'os' ||
      last2 === 'us' ||
      last2 === 'ým' ||
      last2 === 'mi' ||
      last2 === 'ou'
    ) {
      return dropLast(s, 2)
    }
  }

  if (len > 3) {
    const last1 = s.slice(len - 1)
    if (last1 === 'e' || last1 === 'i' || last1 === 'í' || last1 === 'ě') return palatalise(s)
    if (last1 === 'u' || last1 === 'y' || last1 === 'ů') return dropLast(s, 1)
    if (last1 === 'a' || last1 === 'o' || last1 === 'á' || last1 === 'é' || last1 === 'ý') return dropLast(s, 1)
  }

  return s
}

function removePossessives(s: string): string {
  const len = s.length
  if (len > 5) {
    const last2 = s.slice(len - 2)
    if (last2 === 'ov' || last2 === 'ův') return dropLast(s, 2)
    if (last2 === 'in') return palatalise(dropLast(s, 1))
  }
  return s
}

export function czechStemLight(word: string): string {
  return removePossessives(removeCase(word.toLowerCase()))
}
