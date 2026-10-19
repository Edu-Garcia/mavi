import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { splitViolationsBySource } from "../src/report/splitViolationsBySource.ts";

function violation(
  partial: Pick<Violation, "id" | "sourceLayer">,
): Violation {
  return {
    analysisRunId: "run-1",
    wcagCriterion: "1.1.1 Non-text Content",
    description: "desc",
    htmlSnippet: "<img>",
    severity: "serious",
    ...partial,
  };
}

describe("splitViolationsBySource", () => {
  it("separa estruturais e visuais e inclui as detectadas nas duas camadas nas duas listas", () => {
    const split = splitViolationsBySource([
      violation({ id: "axe-1", sourceLayer: "axe" }),
      violation({ id: "vision-1", sourceLayer: "vision" }),
      violation({ id: "both-1", sourceLayer: "both" }),
    ]);

    expect(split.structural.map((item) => item.id)).toEqual(["axe-1", "both-1"]);
    expect(split.visual.map((item) => item.id)).toEqual(["vision-1", "both-1"]);
  });
});
