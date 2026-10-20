import { describe, expect, it } from "vitest";
import { scoreIncompleteVisualRound } from "../../src/evaluation/precisionCoverage/failureCases.ts";
import { scoreByConfiguration } from "../../src/evaluation/precisionCoverage/scoreByConfiguration.ts";
import type { Violation } from "@mavi/shared";

describe("camada visual ausente no benchmark", () => {
  it("marca a rodada como incompleta em vez de recall visual 0", () => {
    const violations: Violation[] = [
      {
        id: "axe-1",
        analysisRunId: "run-1",
        wcagCriterion: "1.4.3 Contrast (Minimum)",
        sourceLayer: "axe",
        description: "contraste",
        htmlSnippet: '<p class="low-contrast-text">x</p>',
        severity: "serious",
      },
    ];
    const incomplete = scoreIncompleteVisualRound(violations, {
      attempted: true,
      error: "Gemini 503 — alta demanda, tente de novo",
    });
    expect(incomplete.status).toBe("incomplete");

    const wronglyZero = scoreByConfiguration(
      [],
      [
        {
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          location: ".low-contrast-text",
        },
      ],
      "visual",
    );
    expect(wronglyZero.truePositives).toBe(0);
    expect(wronglyZero.falseNegatives).toBe(1);
    expect(incomplete.status).not.toBe("completed");
  });
});
