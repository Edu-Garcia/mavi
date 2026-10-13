import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { mergeViolations } from "../src/analysis/merge/mergeViolations.ts";

function axeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "axe-1",
    analysisRunId: "run-1",
    wcagCriterion: "1.1.1 Non-text Content",
    sourceLayer: "axe",
    description: "Imagem sem texto alternativo",
    htmlSnippet: '<img src="produto.jpg">',
    severity: "critical",
    ...overrides,
  };
}

function visionViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "vision-1",
    analysisRunId: "run-1",
    wcagCriterion: "1.4.3 Contrast (Minimum)",
    sourceLayer: "vision",
    description: "Contraste insuficiente no botão",
    htmlSnippet: "botão .cta",
    severity: "serious",
    ...overrides,
  };
}

describe("mergeViolations", () => {
  it("mantém violação só detectada por axe", () => {
    const merged = mergeViolations([axeViolation()], []);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLayer).toBe("axe");
    expect(merged[0]?.id).toBe("axe-1");
  });

  it("mantém violação só detectada por vision", () => {
    const merged = mergeViolations([], [visionViolation()]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLayer).toBe("vision");
    expect(merged[0]?.id).toBe("vision-1");
  });

  it("deduplica critério+região próximos em uma Violation com sourceLayer both", () => {
    const axe = axeViolation({
      id: "axe-alt",
      wcagCriterion: "1.1.1 Non-text Content",
      htmlSnippet: '<img src="produto.jpg" class="hero">',
      description: "Images must have alternate text",
    });
    const vision = visionViolation({
      id: "vision-alt",
      wcagCriterion: "1.1.1 Non-text Content",
      htmlSnippet: "img.hero / produto.jpg",
      description: "Imagem sem alt visível na região do hero",
    });

    const merged = mergeViolations([axe], [vision]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLayer).toBe("both");
    expect(merged[0]?.htmlSnippet).toBe('<img src="produto.jpg" class="hero">');
    expect(merged[0]?.wcagCriterion).toBe("1.1.1 Non-text Content");
  });

  it("não funde violações do mesmo critério em regiões distintas", () => {
    const axe = axeViolation({
      id: "axe-img-a",
      wcagCriterion: "1.1.1 Non-text Content",
      htmlSnippet: '<img src="a.jpg">',
    });
    const vision = visionViolation({
      id: "vision-img-b",
      wcagCriterion: "1.1.1 Non-text Content",
      htmlSnippet: "footer logo b.png",
    });

    const merged = mergeViolations([axe], [vision]);

    expect(merged).toHaveLength(2);
    expect(merged.map((v) => v.sourceLayer).sort()).toEqual(["axe", "vision"]);
  });
});
