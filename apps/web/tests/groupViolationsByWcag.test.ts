import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { groupViolationsByWcag } from "../src/report/groupViolationsByWcag.ts";

function violation(
  partial: Pick<Violation, "id" | "wcagCriterion" | "htmlSnippet">,
): Violation {
  return {
    analysisRunId: "run-1",
    sourceLayer: "axe",
    description: "desc",
    severity: "serious",
    ...partial,
  };
}

describe("groupViolationsByWcag", () => {
  it("agrupa violações pelo critério WCAG e ordena por critério", () => {
    const groups = groupViolationsByWcag([
      violation({
        id: "v2",
        wcagCriterion: "1.3.1 Info and Relationships",
        htmlSnippet: "<h3>",
      }),
      violation({
        id: "v1",
        wcagCriterion: "1.1.1 Non-text Content",
        htmlSnippet: "<img>",
      }),
      violation({
        id: "v3",
        wcagCriterion: "1.1.1 Non-text Content",
        htmlSnippet: "<img src='b'>",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.wcagCriterion).toBe("1.1.1 Non-text Content");
    expect(groups[0]?.violations).toHaveLength(2);
    expect(groups[1]?.wcagCriterion).toBe("1.3.1 Info and Relationships");
    expect(groups[1]?.violations).toHaveLength(1);
  });
});
