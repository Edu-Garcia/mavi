import type { FixSuggestion, Violation } from "@mavi/shared";
import { criterionNumber, sameCriterion } from "../../analysis/wcagCriterion.ts";
import { isIgnoredExtraViolation } from "./scoreByConfiguration.ts";
import type {
  AnalyzeMode,
  ValidationAssertionResult,
  ValidationObservation,
  ValidationPageId,
} from "./types.ts";
import { splitViolationsBySource } from "./splitBySource.ts";

function blob(violation: Violation): string {
  return `${violation.wcagCriterion}\n${violation.description}\n${violation.htmlSnippet}`.toLowerCase();
}

function hasNumber(violations: Violation[], number: string): boolean {
  return violations.some((violation) => sameCriterion(violation.wcagCriterion, number));
}

function hasNumberNear(
  violations: Violation[],
  number: string,
  needles: string[],
): boolean {
  return violations.some(
    (violation) =>
      sameCriterion(violation.wcagCriterion, number) &&
      needles.some((needle) => blob(violation).includes(needle.toLowerCase())),
  );
}

function isHeadingOrder(violation: Violation): boolean {
  const text = blob(violation);
  return (
    /heading-order/.test(text) ||
    (sameCriterion(violation.wcagCriterion, "1.3.1") &&
      /<h[1-6]\b|cabeçal|heading/.test(text))
  );
}

function isForbiddenStructuralNoise(violation: Violation): boolean {
  if (sameCriterion(violation.wcagCriterion, "1.1.1")) {
    return true;
  }
  if (sameCriterion(violation.wcagCriterion, "2.4.4")) {
    return true;
  }
  if (sameCriterion(violation.wcagCriterion, "3.1.1")) {
    return true;
  }
  if (/html-has-lang|link-name/.test(blob(violation))) {
    return true;
  }
  return isHeadingOrder(violation);
}

function isTargetSizeExtra(violation: Violation): boolean {
  return (
    isIgnoredExtraViolation(violation) &&
    (violation.wcagCriterion.trim() === "target-size" ||
      criterionNumber(violation.wcagCriterion) === "2.5.8" ||
      blob(violation).includes("target-size"))
  );
}

function isLandmark(violation: Violation): boolean {
  const criterion = violation.wcagCriterion.trim();
  return criterion === "landmark-one-main" || criterion === "region";
}

function assertion(
  id: string,
  expected: string,
  passed: boolean,
  found: string,
): ValidationAssertionResult {
  return { id, expected, found, passed };
}

function emptyLinkOutcome(
  violations: Violation[],
): ValidationObservation["emptyLinkOutcome"] {
  const emptyLink = violations.filter((violation) =>
    /empty-link|href=["'][^"']*["']/.test(blob(violation)),
  );
  const axeLink = emptyLink.filter(
    (violation) =>
      (violation.sourceLayer === "axe" || violation.sourceLayer === "both") &&
      sameCriterion(violation.wcagCriterion, "2.4.4"),
  );
  const visionTarget = emptyLink.filter(
    (violation) =>
      (violation.sourceLayer === "vision" || violation.sourceLayer === "both") &&
      (sameCriterion(violation.wcagCriterion, "2.5.5") ||
        sameCriterion(violation.wcagCriterion, "2.5.8")),
  );
  const bothSame = emptyLink.some(
    (violation) =>
      violation.sourceLayer === "both" &&
      (sameCriterion(violation.wcagCriterion, "2.4.4") ||
        sameCriterion(violation.wcagCriterion, "2.5.5") ||
        sameCriterion(violation.wcagCriterion, "2.5.8")),
  );
  if (bothSame) {
    return "both";
  }
  if (axeLink.length > 0 && visionTarget.length > 0) {
    return "separate";
  }
  if (axeLink.length > 0) {
    return "axe-only";
  }
  if (visionTarget.length > 0) {
    return "vision-only";
  }
  return "none";
}

function fixCoverage(
  violations: Violation[],
  fixSuggestions: FixSuggestion[],
): { missing: number; covered: number } {
  const ids = new Set(fixSuggestions.map((fix) => fix.violationId));
  const covered = violations.filter((violation) => ids.has(violation.id)).length;
  return { covered, missing: violations.length - covered };
}

export function observeValidation(
  violations: Violation[],
  fixSuggestions: FixSuggestion[] = [],
): ValidationObservation {
  const { structural, visual } = splitViolationsBySource(violations);
  return {
    structural,
    visual,
    violations,
    fixSuggestions,
    diagnostics: {
      stages: [],
      vision: { attempted: false, violationCount: visual.length },
      groq: { attempted: false, suggestionCount: fixSuggestions.length },
      keys: { gemini: true, groq: true },
    },
    emptyLinkOutcome: emptyLinkOutcome(violations),
  };
}

export function assertValidationPage(
  pageId: ValidationPageId,
  observation: ValidationObservation,
  mode: AnalyzeMode,
): ValidationAssertionResult[] {
  const { structural, visual, violations, fixSuggestions } = observation;
  const results: ValidationAssertionResult[] = [];

  if (pageId === "01-controle") {
    const forbidden = structural.filter(isForbiddenStructuralNoise);
    const unexpectedVisual = visual;
    results.push(
      assertion(
        "structural-empty-or-noise",
        "Lista estrutural vazia, ou só ruído que não seja 1.1.1, heading-order, link-name ou lang",
        forbidden.length === 0,
        forbidden.length === 0
          ? structural.length === 0
            ? "vazia"
            : `ruído aceitável: ${structural.map((item) => item.wcagCriterion).join("; ")}`
          : forbidden.map((item) => item.wcagCriterion).join("; "),
      ),
      assertion(
        "visual-empty",
        'Lista visual vazia ("Nenhuma violação visual encontrada")',
        unexpectedVisual.length === 0,
        unexpectedVisual.length === 0
          ? "vazia"
          : unexpectedVisual.map((item) => item.wcagCriterion).join("; "),
      ),
    );
  }

  if (pageId === "02-somente-visuais") {
    const unexpectedStructural = structural.filter(
      (item) => !isTargetSizeExtra(item),
    );
    const forbidden = unexpectedStructural.filter(isForbiddenStructuralNoise);
    const contrast = hasNumberNear(visual, "1.4.3", [
      "low-contrast-on-texture",
      "hero",
      "textura",
      "texture",
      "contraste",
      "promo",
    ]);
    const target = visual.some(
      (item) =>
        (sameCriterion(item.wcagCriterion, "2.5.5") ||
          sameCriterion(item.wcagCriterion, "2.5.8")) &&
        ["tiny-target", "tiny-link", "alvo", "toque", "botão", "botao"].some(
          (needle) => blob(item).includes(needle),
        ),
    );
    results.push(
      assertion(
        "structural-empty-or-target-size",
        "Lista estrutural vazia ou só target-size",
        unexpectedStructural.length === 0 && forbidden.length === 0,
        unexpectedStructural.length === 0
          ? structural.length === 0
            ? "vazia"
            : "só target-size"
          : unexpectedStructural.map((item) => item.wcagCriterion).join("; "),
      ),
      assertion(
        "visual-contrast-hero",
        "≥ 1 item 1.4.3 no hero (.low-contrast-on-texture)",
        contrast,
        contrast ? "1.4.3 encontrado" : "1.4.3 no hero não encontrado",
      ),
      assertion(
        "visual-touch-target",
        "≥ 1 item 2.5.5 ou 2.5.8 (button.tiny-target ou a.tiny-link)",
        target,
        target ? "alvo pequeno encontrado" : "alvo pequeno não encontrado",
      ),
      assertion(
        "structural-no-alt-heading-lang",
        "Estrutural sem 1.1.1, heading-order, link-name ou lang",
        forbidden.length === 0,
        forbidden.length === 0
          ? "ok"
          : forbidden.map((item) => item.wcagCriterion).join("; "),
      ),
    );
  }

  if (pageId === "03-somente-estruturais") {
    const visualFromAltHeadingLink = visual.filter(
      (item) =>
        sameCriterion(item.wcagCriterion, "1.1.1") ||
        sameCriterion(item.wcagCriterion, "2.4.4") ||
        isHeadingOrder(item),
    );
    results.push(
      assertion(
        "structural-image-alt",
        "Estrutural com 1.1.1 (image-alt)",
        hasNumberNear(structural, "1.1.1", ["img", "alt", "imagem"]),
        hasNumber(structural, "1.1.1") ? "1.1.1" : "ausente",
      ),
      assertion(
        "structural-heading-order",
        "Estrutural com 1.3.1 (heading-order)",
        structural.some(isHeadingOrder),
        structural.some(isHeadingOrder) ? "1.3.1 heading-order" : "ausente",
      ),
      assertion(
        "structural-link-name",
        "Estrutural com 2.4.4 (link-name)",
        hasNumber(structural, "2.4.4"),
        hasNumber(structural, "2.4.4") ? "2.4.4" : "ausente",
      ),
      assertion(
        "structural-landmarks",
        "Estrutural com landmarks (landmark-one-main, region)",
        structural.some((item) => item.wcagCriterion === "landmark-one-main") &&
          structural.some((item) => item.wcagCriterion === "region"),
        structural
          .filter(isLandmark)
          .map((item) => item.wcagCriterion)
          .join(", ") || "ausentes",
      ),
      assertion(
        "visual-empty-or-weak",
        "Lista visual vazia ou no máximo um item fraco",
        visual.length <= 1,
        visual.length === 0
          ? "vazia"
          : `${visual.length} item(ns): ${visual.map((item) => item.wcagCriterion).join("; ")}`,
      ),
      assertion(
        "visual-not-source-of-alt-heading-link",
        "Visual não é a fonte de alt, heading ou link",
        visualFromAltHeadingLink.length === 0,
        visualFromAltHeadingLink.length === 0
          ? "ok"
          : visualFromAltHeadingLink.map((item) => item.wcagCriterion).join("; "),
      ),
    );
  }

  if (pageId === "04-visuais-e-estruturais") {
    const outcome = observation.emptyLinkOutcome ?? emptyLinkOutcome(violations);
    const bothOnDifferent =
      violations.some(
        (item) =>
          item.sourceLayer === "both" &&
          sameCriterion(item.wcagCriterion, "1.1.1"),
      ) ||
      violations.some(
        (item) =>
          item.sourceLayer === "both" &&
          sameCriterion(item.wcagCriterion, "1.4.3"),
      );
    results.push(
      assertion(
        "structural-alt-heading-link-landmarks",
        "Estrutural com alt, heading, link vazio e landmarks",
        hasNumber(structural, "1.1.1") &&
          structural.some(isHeadingOrder) &&
          hasNumber(structural, "2.4.4") &&
          structural.some(isLandmark),
        [
          hasNumber(structural, "1.1.1") ? "alt" : "sem alt",
          structural.some(isHeadingOrder) ? "heading" : "sem heading",
          hasNumber(structural, "2.4.4") ? "link" : "sem link",
          structural.some(isLandmark) ? "landmarks" : "sem landmarks",
        ].join(", "),
      ),
      assertion(
        "visual-contrast-and-targets",
        "Visual com contraste do banner e alvos pequenos",
        hasNumber(visual, "1.4.3") &&
          visual.some(
            (item) =>
              sameCriterion(item.wcagCriterion, "2.5.5") ||
              sameCriterion(item.wcagCriterion, "2.5.8"),
          ),
        [
          hasNumber(visual, "1.4.3") ? "1.4.3" : "sem 1.4.3",
          visual.some(
            (item) =>
              sameCriterion(item.wcagCriterion, "2.5.5") ||
              sameCriterion(item.wcagCriterion, "2.5.8"),
          )
            ? "2.5.x"
            : "sem 2.5.x",
        ].join(", "),
      ),
      assertion(
        "empty-link-both-optional",
        "empty-link pode ser 2.4.4 no axe e 2.5.x na visão; both só se critério e região forem iguais",
        outcome !== "none",
        `resultado: ${outcome}`,
      ),
      assertion(
        "no-both-on-alt-and-contrast",
        "Não exigir both em critérios diferentes (alt e contraste nunca viram both)",
        !bothOnDifferent,
        bothOnDifferent
          ? "both indevido em alt ou contraste"
          : "alt e contraste não viraram both",
      ),
    );
  }

  if (mode === "fix") {
    if (pageId === "01-controle") {
      results.push(
        assertion(
          "fix-no-suggestions",
          "Nenhuma sugestão de código gerada",
          fixSuggestions.length === 0,
          `${fixSuggestions.length} sugestão(ões)`,
        ),
      );
    } else {
      const coverage = fixCoverage(violations, fixSuggestions);
      results.push(
        assertion(
          "fix-suggestion-per-violation",
          "Cada violação tem uma sugestão de código do Groq",
          coverage.missing === 0,
          coverage.missing === 0
            ? `${coverage.covered}/${violations.length}`
            : `faltando ${coverage.missing} de ${violations.length}`,
        ),
      );
    }
  }

  return results;
}

export function geminiMustFindPassed(
  foundInRounds: number,
  rounds = 5,
): boolean {
  const need = rounds >= 5 ? 4 : Math.max(1, rounds);
  return foundInRounds >= need;
}

export function geminiMustNotFindPassed(
  foundInRounds: number,
  rounds = 5,
): boolean {
  const failAt = rounds >= 5 ? 2 : Math.max(1, rounds);
  return foundInRounds < failAt;
}
