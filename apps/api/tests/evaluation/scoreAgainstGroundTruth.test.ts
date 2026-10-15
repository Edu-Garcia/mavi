import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { scoreAgainstGroundTruth } from "../../src/evaluation/scoreAgainstGroundTruth.ts";

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

describe("scoreAgainstGroundTruth", () => {
  it("conta verdadeiro positivo quando critério e localização coincidem com o gabarito", () => {
    const score = scoreAgainstGroundTruth(
      [violation()],
      [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
      ],
    );

    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
    expect(score.falseNegatives).toBe(0);
  });

  it("conta falso positivo e falso negativo quando detecção e gabarito não se encontram", () => {
    const score = scoreAgainstGroundTruth(
      [
        violation({
          id: "v-extra",
          wcagCriterion: "2.4.4 Link Purpose (In Context)",
          htmlSnippet: '<a href="/detalhes"></a>',
        }),
      ],
      [
        {
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          location: ".low-contrast-text",
        },
      ],
    );

    expect(score.truePositives).toBe(0);
    expect(score.falsePositives).toBe(1);
    expect(score.falseNegatives).toBe(1);
  });

  it("calcula precisão e recall por categoria WCAG", () => {
    const score = scoreAgainstGroundTruth(
      [
        violation({
          id: "v-produto",
          htmlSnippet: '<img src="produto.jpg">',
        }),
        violation({
          id: "v-hero",
          htmlSnippet: '<img src="hero.png">',
        }),
        violation({
          id: "v-banner",
          htmlSnippet: '<img src="banner.png">',
        }),
        violation({
          id: "v-link",
          wcagCriterion: "2.4.4 Link Purpose (In Context)",
          htmlSnippet: '<a href="/detalhes"></a>',
        }),
      ],
      [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='hero.png']",
        },
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='logo.png']",
        },
        {
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          location: ".low-contrast-text",
        },
      ],
    );

    // 1.1.1: produto e hero acertam; banner sobra; logo falta → 2 VP, 1 FP, 1 FN
    // 1.4.3: só no gabarito → 0 VP, 0 FP, 1 FN
    // 2.4.4: só na detecção → 0 VP, 1 FP, 0 FN
    expect(score.precisionByCategory["1.1.1"]).toBeCloseTo(0.6667, 3);
    expect(score.recallByCategory["1.1.1"]).toBeCloseTo(0.6667, 3);
    expect(score.precisionByCategory["1.4.3"]).toBe(0);
    expect(score.recallByCategory["1.4.3"]).toBe(0);
    expect(score.precisionByCategory["2.4.4"]).toBe(0);
    expect(score.recallByCategory["2.4.4"]).toBe(0);
    expect(score.truePositives).toBe(2);
    expect(score.falsePositives).toBe(2);
    expect(score.falseNegatives).toBe(2);
  });

  it("trata rótulo curto do critério e seletores do catálogo como o mesmo achado", () => {
    const score = scoreAgainstGroundTruth(
      [
        violation({
          id: "v-contrast",
          wcagCriterion: "1.4.3 Contrast",
          htmlSnippet: "texto .low-contrast-text",
          description: "Contraste baixo",
        }),
        violation({
          id: "v-heading",
          wcagCriterion: "1.3.1 Info and Relationships",
          htmlSnippet: "<h3>Pula h2</h3>",
        }),
        violation({
          id: "v-lang",
          wcagCriterion: "3.1.1 Language of Page",
          htmlSnippet: "<html>",
        }),
        violation({
          id: "v-target",
          wcagCriterion: "2.5.5 Target Size",
          htmlSnippet: "button.tiny-target",
        }),
      ],
      [
        {
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          location: ".low-contrast-text",
        },
        {
          wcagCriterion: "1.3.1 Info and Relationships",
          location: "h3",
        },
        {
          wcagCriterion: "3.1.1 Language of Page",
          location: "html",
        },
        {
          wcagCriterion: "2.5.5 Target Size",
          location: "button.tiny-target",
        },
      ],
    );

    expect(score.truePositives).toBe(4);
    expect(score.falsePositives).toBe(0);
    expect(score.falseNegatives).toBe(0);
    expect(score.precisionByCategory["1.4.3"]).toBe(1);
    expect(score.recallByCategory["2.5.5"]).toBe(1);
  });
});
