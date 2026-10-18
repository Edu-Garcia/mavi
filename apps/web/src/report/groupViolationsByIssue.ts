import type { SourceLayer, Violation, ViolationSeverity, WcagCriterion } from "@mavi/shared";

export interface ViolationIssue {
  key: string;
  wcagCriterion: WcagCriterion;
  description: string;
  severity: ViolationSeverity;
  sourceLayer: SourceLayer;
  violations: Violation[];
}

export function issueKey(violation: Violation): string {
  return [
    violation.wcagCriterion,
    violation.sourceLayer,
    violation.severity,
    violation.description,
  ].join("\0");
}

export function groupViolationsByIssue(
  violations: Violation[],
): ViolationIssue[] {
  const byIssue = new Map<string, ViolationIssue>();

  for (const violation of violations) {
    const key = issueKey(violation);
    const existing = byIssue.get(key);
    if (existing) {
      existing.violations.push(violation);
      continue;
    }
    byIssue.set(key, {
      key,
      wcagCriterion: violation.wcagCriterion,
      description: violation.description,
      severity: violation.severity,
      sourceLayer: violation.sourceLayer,
      violations: [violation],
    });
  }

  return [...byIssue.values()];
}
