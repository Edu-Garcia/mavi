import { describe, expect, it } from "vitest";
import {
  mapAxeImpactToSeverity,
  mapAxeTagsToWcagCriterion,
} from "../src/analysis/axe/mapAxeToWcag.ts";

describe("mapAxeTagsToWcagCriterion", () => {
  it("mapeia tag wcag111 para critério 1.1.1 do domínio", () => {
    expect(
      mapAxeTagsToWcagCriterion(
        ["cat.text-alternatives", "wcag2a", "wcag111"],
        "image-alt",
      ),
    ).toBe("1.1.1 Non-text Content");
  });

  it("mapeia tag wcag131 para 1.3.1 Info and Relationships", () => {
    expect(
      mapAxeTagsToWcagCriterion(["wcag2a", "wcag131"], "heading-order"),
    ).toBe("1.3.1 Info and Relationships");
  });

  it("mapeia rule id heading-order sem tag wcag para 1.3.1", () => {
    expect(
      mapAxeTagsToWcagCriterion(["best-practice", "cat.semantics"], "heading-order"),
    ).toBe("1.3.1 Info and Relationships");
  });

  it("formata tag wcag desconhecida como X.Y.Z", () => {
    expect(mapAxeTagsToWcagCriterion(["wcag255"], "some-rule")).toBe("2.5.5");
  });

  it("usa o rule id quando não há tag wcag", () => {
    expect(mapAxeTagsToWcagCriterion(["cat.other"], "custom-rule")).toBe(
      "custom-rule",
    );
  });
});

describe("mapAxeImpactToSeverity", () => {
  it("mapeia impactos axe para ViolationSeverity", () => {
    expect(mapAxeImpactToSeverity("critical")).toBe("critical");
    expect(mapAxeImpactToSeverity("serious")).toBe("serious");
    expect(mapAxeImpactToSeverity("moderate")).toBe("moderate");
    expect(mapAxeImpactToSeverity("minor")).toBe("minor");
  });

  it("usa moderate quando o impacto é nulo", () => {
    expect(mapAxeImpactToSeverity(null)).toBe("moderate");
  });
});
