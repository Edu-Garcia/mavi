import type {
  AnalyzeDiagnostics,
  FixSuggestion,
  GroundTruthViolation,
  Violation,
} from "@mavi/shared";
import type { GroundTruthScore } from "../scoreAgainstGroundTruth.ts";

export type AnalyzeMode = "audit" | "fix";

export type LayerConfiguration = "structural" | "visual" | "complete";

export type PrecisionMode = "strict" | "without-extras";

export type RoundStatus = "completed" | "incomplete" | "lost";

export type ValidationPageId =
  | "01-controle"
  | "02-somente-visuais"
  | "03-somente-estruturais"
  | "04-visuais-e-estruturais";

export const VALIDATION_PAGE_IDS: ValidationPageId[] = [
  "01-controle",
  "02-somente-visuais",
  "03-somente-estruturais",
  "04-visuais-e-estruturais",
];

export const STRUCTURAL_BENCHMARK_IDS = [
  "missing-alt",
  "heading-order",
  "empty-link",
  "missing-lang",
] as const;

export const VISUAL_BENCHMARK_IDS = [
  "dynamic-contrast",
  "inadequate-touch-targets",
] as const;

export type StructuralBenchmarkId = (typeof STRUCTURAL_BENCHMARK_IDS)[number];
export type VisualBenchmarkId = (typeof VISUAL_BENCHMARK_IDS)[number];
export type BenchmarkPageId = StructuralBenchmarkId | VisualBenchmarkId;

export interface ValidationAssertionResult {
  id: string;
  expected: string;
  found: string;
  passed: boolean;
}

export interface ValidationObservation {
  structural: Violation[];
  visual: Violation[];
  violations: Violation[];
  fixSuggestions: FixSuggestion[];
  diagnostics: AnalyzeDiagnostics;
  emptyLinkOutcome?: "both" | "separate" | "axe-only" | "vision-only" | "none";
}

export interface ValidationRoundRecord {
  pageId: ValidationPageId;
  mode: AnalyzeMode;
  round: number;
  status: RoundStatus;
  error?: string;
  assertions: ValidationAssertionResult[];
  observation?: ValidationObservation;
  artifactDir: string;
}

export interface BenchmarkPageScore {
  configuration: LayerConfiguration;
  precisionMode: PrecisionMode;
  score: GroundTruthScore;
  falsePositiveRules: string[];
}

export interface BenchmarkPageRoundRecord {
  pageId: BenchmarkPageId;
  round: number;
  status: RoundStatus;
  error?: string;
  groundTruth: GroundTruthViolation[];
  violations: Violation[];
  scores: BenchmarkPageScore[];
  visualExclusive: boolean | null;
  whoFound?: string[];
  artifactDir: string;
}

export interface FailureCaseRecord {
  id: string;
  pages: string[];
  passed: boolean;
  expected: string;
  found: string;
  details?: string;
}

export interface AmbienteJson {
  collectedAt: string;
  node: string;
  platform: string;
  arch: string;
  playwright: string;
  playwrightBrowser: {
    name: string;
    version: string;
  };
  axeCore: string;
  captureViewport: { width: number; height: number };
  models: {
    gemini: string;
    groq: string;
  };
  prompts: {
    vision: string;
    visionHash: string;
  };
}

export interface PrecisionCoverageSummary {
  outDir: string;
  ambiente: AmbienteJson;
  rounds: number;
  validation: ValidationRoundRecord[];
  benchmark: BenchmarkPageRoundRecord[];
  failures: FailureCaseRecord[];
  fixtureDiff: string;
  choices: string[];
}
