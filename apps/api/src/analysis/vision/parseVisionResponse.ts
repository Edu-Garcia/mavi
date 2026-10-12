import type { ViolationSeverity } from "@mavi/shared";

export interface ParsedVisionViolation {
  wcagCriterion: string;
  description: string;
  location: string;
  severity: ViolationSeverity;
}

const SEVERITIES = new Set<ViolationSeverity>([
  "critical",
  "serious",
  "moderate",
  "minor",
]);

function normalizeSeverity(value: unknown): ViolationSeverity {
  if (typeof value === "string" && SEVERITIES.has(value as ViolationSeverity)) {
    return value as ViolationSeverity;
  }
  return "moderate";
}

function extractJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parse robusto da resposta do Gemini.
 * JSON malformado ou estrutura inesperada → lista vazia (ou parcial).
 */
export function parseVisionResponse(raw: string): ParsedVisionViolation[] {
  const payload = extractJsonPayload(raw);
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const violations = (payload as { violations?: unknown }).violations;
  if (!Array.isArray(violations)) {
    return [];
  }

  const parsed: ParsedVisionViolation[] = [];
  for (const item of violations) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (
      !isNonEmptyString(record.wcagCriterion) ||
      !isNonEmptyString(record.description) ||
      !isNonEmptyString(record.location)
    ) {
      continue;
    }
    parsed.push({
      wcagCriterion: record.wcagCriterion.trim(),
      description: record.description.trim(),
      location: record.location.trim(),
      severity: normalizeSeverity(record.severity),
    });
  }
  return parsed;
}
