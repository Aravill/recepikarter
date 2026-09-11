// Wraps an index into the [0, n) range for the card carousel's infinite
// wraparound — e.g. wrapIndex(-1, 3) === 2, wrapIndex(3, 3) === 0.
// Returns 0 for n <= 0 since there's nothing to wrap into.
export function wrapIndex(i: number, n: number): number {
  if (n <= 0) return 0
  return ((i % n) + n) % n
}
