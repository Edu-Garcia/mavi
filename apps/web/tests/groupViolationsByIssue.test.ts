import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { groupViolationsByIssue } from "../src/report/groupViolationsByIssue.ts";

function violation(
  partial: Pick<Violation, "id" | "wcagCriterion" | "description" | "htmlSnippet"> &
    Partial<Pick<Violation, "severity" | "sourceLayer">>,
): Violation {
  return {
    analysisRunId: "run-1",
    sourceLayer: "axe",
    severity: "serious",
    ...partial,
  };
}

describe("groupViolationsByIssue", () => {
  it("agrupa o mesmo erro em um item com vários trechos", () => {
    const issues = groupViolationsByIssue([
      violation({
        id: "v1",
        wcagCriterion: "1.1.1 Non-text Content",
        description: "As imagens devem ter texto alternativo",
        htmlSnippet: "<img src='a'>",
      }),
      violation({
        id: "v2",
        wcagCriterion: "1.3.1 Info and Relationships",
        description: "Ordem de heading incorreta",
        htmlSnippet: "<h3>",
      }),
      violation({
        id: "v3",
        wcagCriterion: "1.1.1 Non-text Content",
        description: "As imagens devem ter texto alternativo",
        htmlSnippet: "<img src='b'>",
      }),
    ]);

    expect(issues).toHaveLength(2);
    expect(issues[0]?.description).toBe("As imagens devem ter texto alternativo");
    expect(issues[0]?.violations.map((item) => item.htmlSnippet)).toEqual([
      "<img src='a'>",
      "<img src='b'>",
    ]);
    expect(issues[1]?.violations).toHaveLength(1);
  });

  it("não agrupa quando a descrição ou a severidade diferem", () => {
    const issues = groupViolationsByIssue([
      violation({
        id: "v1",
        wcagCriterion: "1.1.1 Non-text Content",
        description: "As imagens devem ter texto alternativo",
        htmlSnippet: "<img src='a'>",
        severity: "critical",
      }),
      violation({
        id: "v2",
        wcagCriterion: "1.1.1 Non-text Content",
        description: "As imagens devem ter texto alternativo",
        htmlSnippet: "<img src='b'>",
        severity: "serious",
      }),
    ]);

    expect(issues).toHaveLength(2);
  });
});
