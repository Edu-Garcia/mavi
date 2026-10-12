import type { ViolationSeverity, WcagCriterion } from "@mavi/shared";

/** Known axe rule tags → domain WCAG criterion labels (PRD / domain vocabulary). */
const TAG_TO_CRITERION: Record<string, WcagCriterion> = {
  wcag111: "1.1.1 Non-text Content",
  wcag131: "1.3.1 Info and Relationships",
  wcag141: "1.4.1 Use of Color",
  wcag143: "1.4.3 Contrast (Minimum)",
  wcag211: "2.1.1 Keyboard",
  wcag241: "2.4.1 Bypass Blocks",
  wcag242: "2.4.2 Page Titled",
  wcag244: "2.4.4 Link Purpose (In Context)",
  wcag246: "2.4.6 Headings and Labels",
  wcag312: "3.1.2 Language of Parts",
  wcag412: "4.1.2 Name, Role, Value",
};

/**
 * Some axe rules (e.g. heading-order) are tagged best-practice only and omit
 * wcag### tags — map those rule ids explicitly to domain WCAG criteria.
 */
const RULE_ID_TO_CRITERION: Record<string, WcagCriterion> = {
  "image-alt": "1.1.1 Non-text Content",
  "heading-order": "1.3.1 Info and Relationships",
};

const IMPACT_TO_SEVERITY: Record<string, ViolationSeverity> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

/**
 * Maps axe-core tags (e.g. `wcag111`) to a domain `WcagCriterion`.
 * Falls back to the first `wcag###` tag formatted as "X.Y.Z", or the rule id.
 */
export function mapAxeTagsToWcagCriterion(
  tags: string[],
  ruleId: string,
): WcagCriterion {
  for (const tag of tags) {
    const mapped = TAG_TO_CRITERION[tag.toLowerCase()];
    if (mapped) {
      return mapped;
    }
  }

  const byRuleId = RULE_ID_TO_CRITERION[ruleId];
  if (byRuleId) {
    return byRuleId;
  }

  const wcagTag = tags.find((tag) => /^wcag\d{3,4}$/i.test(tag));
  if (wcagTag) {
    const digits = wcagTag.replace(/^wcag/i, "");
    if (digits.length === 3) {
      return `${digits[0]}.${digits[1]}.${digits[2]}`;
    }
    if (digits.length === 4) {
      return `${digits[0]}.${digits[1]}.${digits[2]}.${digits[3]}`;
    }
  }

  return ruleId;
}

export function mapAxeImpactToSeverity(
  impact: string | null | undefined,
): ViolationSeverity {
  if (impact && impact in IMPACT_TO_SEVERITY) {
    return IMPACT_TO_SEVERITY[impact]!;
  }
  return "moderate";
}
