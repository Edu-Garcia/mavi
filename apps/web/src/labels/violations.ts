import type { SourceLayer, ViolationSeverity } from "@mavi/shared";

export const SEVERITY_LABEL: Record<ViolationSeverity, string> = {
  critical: "Crítica",
  serious: "Séria",
  moderate: "Moderada",
  minor: "Menor",
};

export const SOURCE_LAYER_LABEL: Record<SourceLayer, string> = {
  axe: "Estrutural (axe)",
  vision: "Visual (Gemini)",
  both: "Ambas",
};
