import { describe, expect, it } from "vitest";
import { loadBenchmarkCatalog } from "../../src/benchmark/loadBenchmarkCatalog.ts";

describe("loadBenchmarkCatalog", () => {
  it("devolve entradas com caminho/conteúdo HTML e groundTruthViolations", () => {
    const catalog = loadBenchmarkCatalog();

    expect(catalog.length).toBeGreaterThanOrEqual(4);

    for (const entry of catalog) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.pageHtmlPath).toMatch(/\.html$/);
      expect(entry.pageHtml).toContain("<");
      expect(Array.isArray(entry.groundTruthViolations)).toBe(true);
      expect(entry.groundTruthViolations.length).toBeGreaterThan(0);

      for (const gt of entry.groundTruthViolations) {
        expect(gt.wcagCriterion.length).toBeGreaterThan(0);
        expect(gt.location.length).toBeGreaterThan(0);
      }
    }
  });

  it("inclui missing-alt, heading-order, dynamic-contrast e inadequate-touch-targets com critérios WCAG conhecidos", () => {
    const catalog = loadBenchmarkCatalog();
    const byId = Object.fromEntries(catalog.map((e) => [e.id, e]));

    expect(byId["missing-alt"]?.groundTruthViolations).toEqual(
      expect.arrayContaining([
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
      ]),
    );

    expect(byId["heading-order"]?.groundTruthViolations).toEqual(
      expect.arrayContaining([
        {
          wcagCriterion: "1.3.1 Info and Relationships",
          location: "h3",
        },
      ]),
    );

    expect(byId["dynamic-contrast"]?.groundTruthViolations).toEqual(
      expect.arrayContaining([
        {
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          location: ".low-contrast-text",
        },
      ]),
    );

    expect(byId["inadequate-touch-targets"]?.groundTruthViolations).toEqual(
      expect.arrayContaining([
        {
          wcagCriterion: "2.5.5 Target Size",
          location: "button.tiny-target",
        },
      ]),
    );
  });
});
