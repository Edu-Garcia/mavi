import type { Violation } from "@mavi/shared";
import { sameCriterion } from "../wcagCriterion.ts";

const GENERIC_TOKENS = new Set([
  "img",
  "div",
  "span",
  "a",
  "p",
  "button",
  "input",
  "src",
  "href",
  "class",
  "id",
  "alt",
  "http",
  "https",
  "www",
  "html",
  "css",
  "the",
  "and",
  "for",
  "with",
]);

function regionTokens(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9._-]+/)
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
  return new Set(tokens);
}

function regionsNear(a: string, b: string): boolean {
  const tokensA = regionTokens(a);
  const tokensB = regionTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return false;
  }
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      return true;
    }
  }
  return false;
}

/**
 * Cruza violações axe e vision: mesmo critério WCAG + região próxima
 * vira uma única Violation com sourceLayer "both".
 */
export function mergeViolations(
  axeViolations: Violation[],
  visionViolations: Violation[],
): Violation[] {
  const unmatchedVision = [...visionViolations];
  const merged: Violation[] = [];

  for (const axe of axeViolations) {
    const matchIndex = unmatchedVision.findIndex(
      (vision) =>
        sameCriterion(vision.wcagCriterion, axe.wcagCriterion) &&
        regionsNear(axe.htmlSnippet, vision.htmlSnippet),
    );

    if (matchIndex >= 0) {
      unmatchedVision.splice(matchIndex, 1);
      merged.push({ ...axe, sourceLayer: "both" });
    } else {
      merged.push(axe);
    }
  }

  merged.push(...unmatchedVision);
  return merged;
}
