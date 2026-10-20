/** Compara critérios WCAG pelo número (`1.4.3`), não pelo rótulo. */

export function criterionNumber(criterion: string): string | null {
  const match = criterion.trim().match(/^(\d+(?:\.\d+)+)/);
  return match?.[1] ?? null;
}

export function sameCriterion(detected: string, expected: string): boolean {
  const detectedNumber = criterionNumber(detected);
  const expectedNumber = criterionNumber(expected);
  if (detectedNumber && expectedNumber) {
    return detectedNumber === expectedNumber;
  }
  return detected.trim().toLowerCase() === expected.trim().toLowerCase();
}
