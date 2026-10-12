import type { Violation, WcagCriterion } from "@mavi/shared";

export interface ViolationWcagGroup {
  wcagCriterion: WcagCriterion;
  violations: Violation[];
}

export function groupViolationsByWcag(
  violations: Violation[],
): ViolationWcagGroup[] {
  const byCriterion = new Map<WcagCriterion, Violation[]>();

  for (const violation of violations) {
    const existing = byCriterion.get(violation.wcagCriterion);
    if (existing) {
      existing.push(violation);
    } else {
      byCriterion.set(violation.wcagCriterion, [violation]);
    }
  }

  return [...byCriterion.entries()]
    .map(([wcagCriterion, group]) => ({
      wcagCriterion,
      violations: group,
    }))
    .sort((a, b) => a.wcagCriterion.localeCompare(b.wcagCriterion));
}
