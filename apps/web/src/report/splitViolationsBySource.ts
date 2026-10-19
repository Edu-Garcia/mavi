import type { Violation } from "@mavi/shared";

export interface ViolationsBySource {
  structural: Violation[];
  visual: Violation[];
}

export function splitViolationsBySource(
  violations: Violation[],
): ViolationsBySource {
  const structural: Violation[] = [];
  const visual: Violation[] = [];

  for (const violation of violations) {
    if (violation.sourceLayer === "axe" || violation.sourceLayer === "both") {
      structural.push(violation);
    }
    if (violation.sourceLayer === "vision" || violation.sourceLayer === "both") {
      visual.push(violation);
    }
  }

  return { structural, visual };
}
