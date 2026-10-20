import { describe, expect, it } from "vitest";
import type { FixSuggestion, Violation } from "@mavi/shared";
import {
  assertValidationPage,
  geminiMustFindPassed,
  geminiMustNotFindPassed,
  observeValidation,
} from "../../src/evaluation/precisionCoverage/assertValidation.ts";

function violation(overrides: Partial<Violation>): Violation {
  return {
    analysisRunId: "run-1",
    description: "desc",
    htmlSnippet: "<div>",
    severity: "serious",
    sourceLayer: "axe",
    wcagCriterion: "1.1.1 Non-text Content",
    id: "v",
    ...overrides,
  };
}

describe("assertValidationPage", () => {
  it("aceita controle sem violações e recusa ruído estrutural proibido", () => {
    const empty = assertValidationPage(
      "01-controle",
      observeValidation([]),
      "audit",
    );
    expect(empty.every((item) => item.passed)).toBe(true);

    const noise = assertValidationPage(
      "01-controle",
      observeValidation([
        violation({
          id: "alt",
          wcagCriterion: "1.1.1 Non-text Content",
          htmlSnippet: "<img>",
        }),
      ]),
      "audit",
    );
    expect(noise.find((item) => item.id === "structural-empty-or-noise")?.passed).toBe(
      false,
    );

    const landmark = assertValidationPage(
      "01-controle",
      observeValidation([
        violation({
          id: "lm",
          wcagCriterion: "landmark-one-main",
          htmlSnippet: "<html>",
        }),
      ]),
      "audit",
    );
    expect(
      landmark.find((item) => item.id === "structural-empty-or-noise")?.passed,
    ).toBe(true);
  });

  it("exige contraste e alvo na página só visual, e aceita target-size no axe", () => {
    const passed = assertValidationPage(
      "02-somente-visuais",
      observeValidation([
        violation({
          id: "axe-size",
          sourceLayer: "axe",
          wcagCriterion: "2.5.8",
          htmlSnippet: '<button class="tiny-target">+</button>',
        }),
        violation({
          id: "contrast",
          sourceLayer: "vision",
          wcagCriterion: "1.4.3 Contrast",
          htmlSnippet: ".low-contrast-on-texture",
          description: "Contraste baixo no hero",
        }),
        violation({
          id: "target",
          sourceLayer: "vision",
          wcagCriterion: "2.5.5 Target Size",
          htmlSnippet: "button.tiny-target",
          description: "Alvo de toque pequeno",
        }),
      ]),
      "audit",
    );
    expect(passed.every((item) => item.passed)).toBe(true);
  });

  it("exige alt, heading, link e landmarks na página só estrutural", () => {
    const passed = assertValidationPage(
      "03-somente-estruturais",
      observeValidation([
        violation({
          id: "alt",
          wcagCriterion: "1.1.1 Non-text Content",
          htmlSnippet: "<img src='x'>",
        }),
        violation({
          id: "h",
          wcagCriterion: "1.3.1 Info and Relationships",
          htmlSnippet: "<h3>x</h3>",
          description: "heading-order",
        }),
        violation({
          id: "link",
          wcagCriterion: "2.4.4 Link Purpose (In Context)",
          htmlSnippet: '<a class="empty-link" href="/x"></a>',
        }),
        violation({
          id: "main",
          wcagCriterion: "landmark-one-main",
          htmlSnippet: "<html>",
        }),
        violation({
          id: "region",
          wcagCriterion: "region",
          htmlSnippet: "<div>",
        }),
      ]),
      "audit",
    );
    expect(passed.every((item) => item.passed)).toBe(true);
  });

  it("no modo com sugestões exige uma correção por violação, e nenhuma na 01", () => {
    const violations: Violation[] = [
      violation({
        id: "alt",
        wcagCriterion: "1.1.1 Non-text Content",
        htmlSnippet: "<img>",
      }),
    ];
    const fixes: FixSuggestion[] = [
      {
        id: "f1",
        violationId: "alt",
        diffBefore: "<img>",
        diffAfter: '<img alt="x">',
        explanation: "ok",
        generatedAt: new Date("2026-10-19T00:00:00.000Z"),
      },
    ];
    const withFix = assertValidationPage(
      "03-somente-estruturais",
      observeValidation(violations, fixes),
      "fix",
    );
    expect(
      withFix.find((item) => item.id === "fix-suggestion-per-violation")?.passed,
    ).toBe(true);

    const control = assertValidationPage(
      "01-controle",
      observeValidation([], fixes),
      "fix",
    );
    expect(control.find((item) => item.id === "fix-no-suggestions")?.passed).toBe(
      false,
    );
  });
});

describe("regra das 5 rodadas do Gemini", () => {
  it("deve achar passa em ≥ 4/5 e não deve achar falha em ≥ 2/5", () => {
    expect(geminiMustFindPassed(4)).toBe(true);
    expect(geminiMustFindPassed(3)).toBe(false);
    expect(geminiMustNotFindPassed(1)).toBe(true);
    expect(geminiMustNotFindPassed(2)).toBe(false);
  });
});
