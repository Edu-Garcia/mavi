export type WcagCriterion = string;

export type SourceLayer = "axe" | "vision" | "both";

export type AnalysisRunStatus = "pending" | "running" | "completed" | "failed";

export type ViolationSeverity = "critical" | "serious" | "moderate" | "minor";

export interface Page {
  id: string;
  url: string;
  capturedHtml: string;
  screenshotPath: string;
  createdAt: Date;
}

export interface ModelVersions {
  gemini?: string;
  llama?: string;
  axeCore?: string;
  visionPrompt?: string;
  fixPrompt?: string;
}

export interface AnalysisRun {
  id: string;
  pageId: string;
  status: AnalysisRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  modelVersions: ModelVersions;
}

export interface Violation {
  id: string;
  analysisRunId: string;
  wcagCriterion: WcagCriterion;
  sourceLayer: SourceLayer;
  description: string;
  htmlSnippet: string;
  severity: ViolationSeverity;
}

export interface FixSuggestion {
  id: string;
  violationId: string;
  diffBefore: string;
  diffAfter: string;
  explanation: string;
  generatedAt: Date;
}

export interface GroundTruthViolation {
  wcagCriterion: WcagCriterion;
  location: string;
}

export interface BenchmarkCase {
  id: string;
  pageId: string;
  groundTruthViolations: GroundTruthViolation[];
}

export interface EvaluationResult {
  id: string;
  benchmarkCaseId: string;
  analysisRunId: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precisionByCategory: Record<WcagCriterion, number>;
  recallByCategory: Record<WcagCriterion, number>;
}

export interface AnalysisLayer {
  analyze(page: Page, analysisRun: AnalysisRun): Promise<Violation[]>;
}

export type PipelineStageName =
  | "start"
  | "capture"
  | "axe"
  | "vision"
  | "merge"
  | "groq"
  | "done";

export type PipelineStageStatus = "ok" | "skipped" | "error";

export interface PipelineStageDiagnostic {
  name: PipelineStageName;
  status: PipelineStageStatus;
  durationMs: number;
}

export type VisionSkipReason = "missing_key";

export type GroqSkipReason = "missing_key" | "audit_mode";

export interface VisionDiagnostic {
  attempted: boolean;
  skippedReason?: VisionSkipReason;
  error?: string;
  violationCount: number;
}

export interface GroqDiagnostic {
  attempted: boolean;
  skippedReason?: GroqSkipReason;
  error?: string;
  suggestionCount: number;
}

export interface AnalyzeDiagnostics {
  stages: PipelineStageDiagnostic[];
  vision: VisionDiagnostic;
  groq: GroqDiagnostic;
  keys: {
    gemini: boolean;
    groq: boolean;
  };
}

export function emptyAnalyzeDiagnostics(): AnalyzeDiagnostics {
  return {
    stages: [],
    vision: { attempted: false, violationCount: 0 },
    groq: { attempted: false, suggestionCount: 0 },
    keys: { gemini: false, groq: false },
  };
}
