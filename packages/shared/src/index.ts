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
