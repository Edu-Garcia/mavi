import type { GroundTruthViolation, SourceLayer, Violation } from "@mavi/shared";
import { criterionNumber } from "../../analysis/wcagCriterion.ts";
import {
  scoreAgainstGroundTruth,
  type GroundTruthScore,
} from "../scoreAgainstGroundTruth.ts";
import { EXTRA_AXE_RULE_IDS } from "./extraRules.ts";
import type { LayerConfiguration, PrecisionMode } from "./types.ts";

const STRUCTURAL_LAYERS: ReadonlySet<SourceLayer> = new Set(["axe", "both"]);
const VISUAL_LAYERS: ReadonlySet<SourceLayer> = new Set(["vision", "both"]);

export function violationsForConfiguration(
  violations: Violation[],
  configuration: LayerConfiguration,
): Violation[] {
  if (configuration === "complete") {
    return violations;
  }
  const allowed =
    configuration === "structural" ? STRUCTURAL_LAYERS : VISUAL_LAYERS;
  return violations.filter((violation) => allowed.has(violation.sourceLayer));
}

export function isIgnoredExtraViolation(violation: Violation): boolean {
  if (violation.sourceLayer === "vision") {
    return false;
  }
  const criterion = violation.wcagCriterion.trim();
  const number = criterionNumber(criterion);
  if ((EXTRA_AXE_RULE_IDS as readonly string[]).includes(criterion)) {
    return true;
  }
  if (number === "2.5.8") {
    return true;
  }
  const blob = `${criterion}\n${violation.description}`.toLowerCase();
  return EXTRA_AXE_RULE_IDS.some((ruleId) => blob.includes(ruleId));
}

function scoreInput(
  violations: Violation[],
  configuration: LayerConfiguration,
  precisionMode: PrecisionMode,
): Violation[] {
  const byLayer = violationsForConfiguration(violations, configuration);
  if (precisionMode === "strict") {
    return byLayer;
  }
  return byLayer.filter((violation) => !isIgnoredExtraViolation(violation));
}

export function falsePositiveLabels(
  violations: Violation[],
  groundTruth: GroundTruthViolation[],
  configuration: LayerConfiguration,
  precisionMode: PrecisionMode,
): string[] {
  const considered = scoreInput(violations, configuration, precisionMode);
  const leftover = [...considered];
  for (const expected of groundTruth) {
    const index = leftover.findIndex(
      (violation) =>
        scoreAgainstGroundTruth([violation], [expected]).truePositives === 1,
    );
    if (index >= 0) {
      leftover.splice(index, 1);
    }
  }
  return leftover.map(
    (violation) =>
      criterionNumber(violation.wcagCriterion) ?? violation.wcagCriterion,
  );
}

export function scoreByConfiguration(
  violations: Violation[],
  groundTruth: GroundTruthViolation[],
  configuration: LayerConfiguration,
  precisionMode: PrecisionMode = "strict",
): GroundTruthScore {
  return scoreAgainstGroundTruth(
    scoreInput(violations, configuration, precisionMode),
    groundTruth,
  );
}
