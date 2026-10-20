import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import {
  isIgnoredExtraViolation,
  scoreByConfiguration,
  violationsForConfiguration,
} from "../../src/evaluation/precisionCoverage/scoreByConfiguration.ts";

function violation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "v-1",
    analysisRunId: "run-1",
    wcagCriterion: "1.1.1 Non-text Content",
    sourceLayer: "axe",
    description: "Imagem sem texto alternativo",
    htmlSnippet: '<img src="produto.jpg">',
    severity: "critical",
    ...overrides,
  };
}

describe("scoreByConfiguration", () => {
  it("separa achados estruturais, visuais e completos pelo sourceLayer", () => {
    const items = [
      violation({ id: "axe", sourceLayer: "axe" }),
      violation({
        id: "vision",
        sourceLayer: "vision",
        wcagCriterion: "1.4.3 Contrast",
        htmlSnippet: ".low-contrast-text",
      }),
      violation({ id: "both", sourceLayer: "both" }),
    ];

    expect(
      violationsForConfiguration(items, "structural").map((item) => item.id),
    ).toEqual(["axe", "both"]);
    expect(
      violationsForConfiguration(items, "visual").map((item) => item.id),
    ).toEqual(["vision", "both"]);
    expect(violationsForConfiguration(items, "complete")).toHaveLength(3);
  });

  it("ignora landmark-one-main, region e target-size na precisão sem extras", () => {
    const extras = [
      violation({
        id: "landmark",
        wcagCriterion: "landmark-one-main",
        htmlSnippet: "<html>",
      }),
      violation({
        id: "region",
        wcagCriterion: "region",
        htmlSnippet: "<header>",
      }),
      violation({
        id: "target",
        wcagCriterion: "2.5.8 Target Size",
        htmlSnippet: '<button class="tiny-target">+</button>',
      }),
      violation({
        id: "alt",
        htmlSnippet: '<img src="produto.jpg">',
      }),
    ];

    expect(extras.filter(isIgnoredExtraViolation).map((item) => item.id)).toEqual(
      ["landmark", "region", "target"],
    );

    const strict = scoreByConfiguration(
      extras,
      [{ wcagCriterion: "1.1.1 Non-text Content", location: "img[src='produto.jpg']" }],
      "structural",
      "strict",
    );
    const withoutExtras = scoreByConfiguration(
      extras,
      [{ wcagCriterion: "1.1.1 Non-text Content", location: "img[src='produto.jpg']" }],
      "structural",
      "without-extras",
    );

    expect(strict.truePositives).toBe(1);
    expect(strict.falsePositives).toBe(3);
    expect(withoutExtras.truePositives).toBe(1);
    expect(withoutExtras.falsePositives).toBe(0);
  });

  it("não ignora achado visual de 2.5.5 como extra de target-size", () => {
    const visual = violation({
      id: "vision-target",
      sourceLayer: "vision",
      wcagCriterion: "2.5.5 Target Size",
      htmlSnippet: "button.tiny-target",
    });
    expect(isIgnoredExtraViolation(visual)).toBe(false);

    const score = scoreByConfiguration(
      [visual],
      [{ wcagCriterion: "2.5.5 Target Size", location: "button.tiny-target" }],
      "visual",
      "without-extras",
    );
    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
  });

  it("na configuração visual não conta achado só do axe", () => {
    const score = scoreByConfiguration(
      [
        violation({
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
        }),
      ],
      [{ wcagCriterion: "1.1.1 Non-text Content", location: "img[src='produto.jpg']" }],
      "visual",
    );
    expect(score.truePositives).toBe(0);
    expect(score.falseNegatives).toBe(1);
    expect(score.falsePositives).toBe(0);
  });
});
