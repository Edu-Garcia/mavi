import type { GroundTruthViolation, Violation } from "@mavi/shared";

export interface CategoryCounts {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface GroundTruthScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precisionByCategory: Record<string, number>;
  recallByCategory: Record<string, number>;
  countsByCategory: Record<string, CategoryCounts>;
}

function categoryKey(criterion: string): string {
  return criterionNumber(criterion) ?? criterion.trim();
}

function emptyCounts(): CategoryCounts {
  return { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
}

function addCount(
  counts: Record<string, CategoryCounts>,
  criterion: string,
  field: keyof CategoryCounts,
): void {
  const key = categoryKey(criterion);
  const current = counts[key] ?? emptyCounts();
  current[field] += 1;
  counts[key] = current;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function accumulateCategoryCounts(
  target: Record<string, CategoryCounts>,
  addition: Record<string, CategoryCounts>,
): void {
  for (const [key, counts] of Object.entries(addition)) {
    const current = target[key] ?? emptyCounts();
    current.truePositives += counts.truePositives;
    current.falsePositives += counts.falsePositives;
    current.falseNegatives += counts.falseNegatives;
    target[key] = current;
  }
}

export function ratiosFromCounts(countsByCategory: Record<string, CategoryCounts>): {
  precisionByCategory: Record<string, number>;
  recallByCategory: Record<string, number>;
} {
  const precisionByCategory: Record<string, number> = {};
  const recallByCategory: Record<string, number> = {};
  for (const [key, counts] of Object.entries(countsByCategory)) {
    precisionByCategory[key] = ratio(
      counts.truePositives,
      counts.truePositives + counts.falsePositives,
    );
    recallByCategory[key] = ratio(
      counts.truePositives,
      counts.truePositives + counts.falseNegatives,
    );
  }
  return { precisionByCategory, recallByCategory };
}

function criterionNumber(criterion: string): string | null {
  const match = criterion.trim().match(/^(\d+(?:\.\d+)+)/);
  return match?.[1] ?? null;
}

function sameCriterion(detected: string, expected: string): boolean {
  const detectedNumber = criterionNumber(detected);
  const expectedNumber = criterionNumber(expected);
  if (detectedNumber && expectedNumber) {
    return detectedNumber === expectedNumber;
  }
  return detected.trim().toLowerCase() === expected.trim().toLowerCase();
}

function locationMatches(location: string, htmlSnippet: string): boolean {
  const loc = location.trim().toLowerCase();
  const snippet = htmlSnippet.toLowerCase();
  const quoted = [...loc.matchAll(/['"]([^'"]+)['"]/g)].map((match) =>
    match[1]!.toLowerCase(),
  );
  const classes = [...loc.matchAll(/\.([a-z0-9_-]+)/gi)].map((match) =>
    match[1]!.toLowerCase(),
  );
  const ids = [...loc.matchAll(/#([a-z0-9_-]+)/gi)].map((match) =>
    match[1]!.toLowerCase(),
  );
  const qualifiers = [...quoted, ...classes, ...ids];

  if (qualifiers.length > 0) {
    return qualifiers.every((qualifier) => snippet.includes(qualifier));
  }

  if (snippet.includes(loc)) {
    return true;
  }

  const tag = loc.match(/^([a-z][a-z0-9]*)\b/i)?.[1];
  if (tag && new RegExp(`<${tag}\\b`, "i").test(htmlSnippet)) {
    return true;
  }

  return false;
}

/**
 * Compara Violation[] ao gabarito: mesmo critério WCAG e localização
 * próxima contam como um verdadeiro positivo (emparelhamento 1:1).
 */
export function scoreAgainstGroundTruth(
  violations: Violation[],
  groundTruth: GroundTruthViolation[],
): GroundTruthScore {
  const unmatched = [...violations];
  const countsByCategory: Record<string, CategoryCounts> = {};
  let truePositives = 0;

  for (const expected of groundTruth) {
    const matchIndex = unmatched.findIndex(
      (violation) =>
        sameCriterion(violation.wcagCriterion, expected.wcagCriterion) &&
        locationMatches(
          expected.location,
          `${violation.htmlSnippet}\n${violation.description}`,
        ),
    );

    if (matchIndex >= 0) {
      const matched = unmatched.splice(matchIndex, 1)[0]!;
      truePositives += 1;
      addCount(countsByCategory, matched.wcagCriterion, "truePositives");
    } else {
      addCount(countsByCategory, expected.wcagCriterion, "falseNegatives");
    }
  }

  for (const violation of unmatched) {
    addCount(countsByCategory, violation.wcagCriterion, "falsePositives");
  }

  const { precisionByCategory, recallByCategory } =
    ratiosFromCounts(countsByCategory);

  return {
    truePositives,
    falsePositives: unmatched.length,
    falseNegatives: groundTruth.length - truePositives,
    precisionByCategory,
    recallByCategory,
    countsByCategory,
  };
}
