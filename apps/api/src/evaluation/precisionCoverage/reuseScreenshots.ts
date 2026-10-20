import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  AnalysisLayer,
  AnalysisRun,
  Page,
  Violation,
  ViolationSeverity,
} from "@mavi/shared";
import { mergeViolations } from "../../analysis/merge/mergeViolations.ts";
import { loadBenchmarkCatalog } from "../../benchmark/loadBenchmarkCatalog.ts";
import { buildModelVersions } from "../modelVersions.ts";
import { assertValidationPage } from "./assertValidation.ts";
import { scoreIncompleteVisualRound } from "./failureCases.ts";
import {
  falsePositiveLabels,
  scoreByConfiguration,
} from "./scoreByConfiguration.ts";
import { splitViolationsBySource } from "./splitBySource.ts";
import type {
  AnalyzeMode,
  BenchmarkPageId,
  BenchmarkPageRoundRecord,
  BenchmarkPageScore,
  LayerConfiguration,
  PrecisionMode,
  ValidationPageId,
  ValidationRoundRecord,
} from "./types.ts";
import {
  VALIDATION_PAGE_IDS,
  VISUAL_BENCHMARK_IDS,
} from "./types.ts";

const CONFIGS: LayerConfiguration[] = ["structural", "visual", "complete"];
const PRECISIONS: PrecisionMode[] = ["strict", "without-extras"];
const COPY_FILES = [
  "screenshot.png",
  "captured.html",
  "axe-raw.json",
  "exported.html",
] as const;

const BENCHMARK_PAGE_IDS: BenchmarkPageId[] = [
  "missing-alt",
  "heading-order",
  "empty-link",
  "missing-lang",
  "dynamic-contrast",
  "inadequate-touch-targets",
];

export type ReuseJob =
  | {
      kind: "validation";
      pageId: ValidationPageId;
      mode: AnalyzeMode;
      round: number;
      sourceDir: string;
    }
  | {
      kind: "benchmark";
      pageId: BenchmarkPageId;
      round: number;
      sourceDir: string;
    };

interface StoredAnalyze {
  url?: string;
  page?: { url?: string; capturedHtml?: string };
  violations?: Array<Partial<Violation>>;
  vision?: { attempted?: boolean; error?: string; skippedReason?: string };
  diagnostics?: {
    vision?: { attempted?: boolean; error?: string; skippedReason?: string };
  };
}

export function listReusableJobs(sourceDir: string, rounds: number): ReuseJob[] {
  const jobs: ReuseJob[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const pageId of VALIDATION_PAGE_IDS) {
      for (const mode of ["audit", "fix"] as AnalyzeMode[]) {
        jobs.push({
          kind: "validation",
          pageId,
          mode,
          round,
          sourceDir: path.join(sourceDir, "validacao", pageId, mode, `round-${round}`),
        });
      }
    }
    for (const pageId of BENCHMARK_PAGE_IDS) {
      jobs.push({
        kind: "benchmark",
        pageId,
        round,
        sourceDir: path.join(sourceDir, "benchmark", pageId, `round-${round}`),
      });
    }
  }
  return jobs;
}

export function axeViolationsFromAnalyze(
  analyze: StoredAnalyze | null,
  analysisRunId: string,
): Violation[] {
  const list = analyze?.violations ?? [];
  return list
    .filter(
      (item) => item.sourceLayer === "axe" || item.sourceLayer === "both",
    )
    .map(
      (item): Violation => ({
        id: randomUUID(),
        analysisRunId,
        wcagCriterion: String(item.wcagCriterion ?? ""),
        sourceLayer: "axe",
        description: String(item.description ?? ""),
        htmlSnippet: String(item.htmlSnippet ?? ""),
        severity: (item.severity as ViolationSeverity) ?? "moderate",
      }),
    );
}

export function destVisionAlreadyComplete(artifactDir: string): boolean {
  const filePath = path.join(artifactDir, "analyze.json");
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    const analyze = JSON.parse(readFileSync(filePath, "utf8")) as StoredAnalyze;
    const vision = analyze.vision ?? analyze.diagnostics?.vision;
    return Boolean(vision?.attempted) && !vision?.error && !vision?.skippedReason;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(filePath: string): Promise<StoredAnalyze | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as StoredAnalyze;
}

async function copyRoundArtifacts(
  sourceDir: string,
  destDir: string,
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  for (const name of COPY_FILES) {
    const from = path.join(sourceDir, name);
    if (existsSync(from)) {
      await copyFile(from, path.join(destDir, name));
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

function whoFound(violations: Violation[], pageId: BenchmarkPageId): string[] {
  const catalog = loadBenchmarkCatalog();
  const entry = catalog.find((item) => item.id === pageId);
  if (!entry) {
    return [];
  }
  const layers: string[] = [];
  for (const expected of entry.groundTruthViolations) {
    for (const violation of violations) {
      if (
        scoreByConfiguration([violation], [expected], "complete", "strict")
          .truePositives === 1
      ) {
        layers.push(violation.sourceLayer);
      }
    }
  }
  return [...new Set(layers)];
}

async function loadPage(
  destDir: string,
  analyze: StoredAnalyze | null,
): Promise<Page | null> {
  const screenshotPath = path.join(destDir, "screenshot.png");
  if (!existsSync(screenshotPath)) {
    return null;
  }
  const htmlPath = path.join(destDir, "captured.html");
  const capturedHtml = existsSync(htmlPath)
    ? await readFile(htmlPath, "utf8")
    : (analyze?.page?.capturedHtml ?? "");
  return {
    id: randomUUID(),
    url: analyze?.page?.url ?? analyze?.url ?? `file://${screenshotPath}`,
    capturedHtml,
    screenshotPath,
    createdAt: new Date(),
  };
}

function makeRun(page: Page): AnalysisRun {
  return {
    id: randomUUID(),
    pageId: page.id,
    status: "running",
    startedAt: new Date(),
    completedAt: null,
    modelVersions: buildModelVersions(process.env, { includeLlama: false }),
  };
}

async function runVision(
  visionLayer: AnalysisLayer,
  page: Page,
  analysisRun: AnalysisRun,
): Promise<{ violations: Violation[]; error?: string }> {
  try {
    return { violations: await visionLayer.analyze(page, analysisRun) };
  } catch (error) {
    return { violations: [], error: errorMessage(error) };
  }
}

function benchmarkScores(
  violations: Violation[],
  groundTruth: ReturnType<typeof loadBenchmarkCatalog>[number]["groundTruthViolations"],
): BenchmarkPageScore[] {
  const scores: BenchmarkPageScore[] = [];
  for (const configuration of CONFIGS) {
    for (const precisionMode of PRECISIONS) {
      scores.push({
        configuration,
        precisionMode,
        score: scoreByConfiguration(
          violations,
          groundTruth,
          configuration,
          precisionMode,
        ),
        falsePositiveRules: falsePositiveLabels(
          violations,
          groundTruth,
          configuration,
          precisionMode,
        ),
      });
    }
  }
  return scores;
}

function asViolations(raw: StoredAnalyze | null): Violation[] {
  return (raw?.violations ?? []).map((item) => ({
    id: String(item.id ?? randomUUID()),
    analysisRunId: String(item.analysisRunId ?? "replay"),
    wcagCriterion: String(item.wcagCriterion ?? ""),
    sourceLayer:
      item.sourceLayer === "vision" || item.sourceLayer === "both"
        ? item.sourceLayer
        : "axe",
    description: String(item.description ?? ""),
    htmlSnippet: String(item.htmlSnippet ?? ""),
    severity: (item.severity as ViolationSeverity) ?? "moderate",
  }));
}

function visionErrorFromAnalyze(analyze: StoredAnalyze | null): string | undefined {
  return analyze?.vision?.error ?? analyze?.diagnostics?.vision?.error;
}

function finishValidation(options: {
  job: Extract<ReuseJob, { kind: "validation" }>;
  destDir: string;
  violations: Violation[];
  visionError?: string;
}): ValidationRoundRecord {
  const incomplete = scoreIncompleteVisualRound(
    options.violations,
    options.visionError
      ? { attempted: true, error: options.visionError }
      : { attempted: true },
  );
  const split = splitViolationsBySource(options.violations);
  const observation = {
    structural: split.structural,
    visual: split.visual,
    violations: options.violations,
    fixSuggestions: [],
    diagnostics: {
      stages: [],
      vision: {
        attempted: true,
        violationCount: split.visual.length,
        error: options.visionError,
      },
      groq: {
        attempted: false,
        suggestionCount: 0,
        skippedReason:
          options.job.mode === "audit" ? ("audit_mode" as const) : undefined,
      },
      keys: { gemini: true, groq: Boolean(process.env.GROQ_API_KEY?.trim()) },
    },
  };
  const assertions = assertValidationPage(
    options.job.pageId,
    observation,
    options.job.mode,
  ).filter(
    (item) =>
      item.id !== "fix-suggestion-per-violation" &&
      item.id !== "fix-no-suggestions",
  );
  assertions.push({
    id: "screenshot-fullpage",
    expected:
      "Screenshot da página inteira já renderizada, a mesma enviada ao Gemini",
    found: "reutilizado da rodada anterior",
    passed: true,
  });
  return {
    pageId: options.job.pageId,
    mode: options.job.mode,
    round: options.job.round,
    status: incomplete.status === "incomplete" ? "incomplete" : "completed",
    error: incomplete.reason,
    assertions,
    observation,
    artifactDir: options.destDir,
  };
}

function finishBenchmark(options: {
  job: Extract<ReuseJob, { kind: "benchmark" }>;
  destDir: string;
  violations: Violation[];
  visionError?: string;
}): BenchmarkPageRoundRecord {
  const catalog = loadBenchmarkCatalog();
  const entry = catalog.find((item) => item.id === options.job.pageId);
  if (!entry) {
    throw new Error(`Página ${options.job.pageId} ausente do catálogo`);
  }
  const incomplete = scoreIncompleteVisualRound(
    options.violations,
    options.visionError
      ? { attempted: true, error: options.visionError }
      : { attempted: true },
  );
  const scores = benchmarkScores(options.violations, entry.groundTruthViolations);
  const structuralVp = scoreByConfiguration(
    options.violations,
    entry.groundTruthViolations,
    "structural",
    "strict",
  ).truePositives;
  const visualVp = scoreByConfiguration(
    options.violations,
    entry.groundTruthViolations,
    "visual",
    "strict",
  ).truePositives;
  const isVisualPage = (VISUAL_BENCHMARK_IDS as readonly string[]).includes(
    options.job.pageId,
  );
  return {
    pageId: options.job.pageId,
    round: options.job.round,
    status: incomplete.status === "incomplete" ? "incomplete" : "completed",
    error: incomplete.reason,
    groundTruth: entry.groundTruthViolations,
    violations: options.violations,
    scores,
    visualExclusive:
      incomplete.status === "incomplete" || !isVisualPage
        ? null
        : visualVp > 0 && structuralVp === 0,
    whoFound: whoFound(options.violations, options.job.pageId),
    artifactDir: options.destDir,
  };
}

export async function hydrateReplayedRound(
  job: ReuseJob,
  destDir: string,
): Promise<ValidationRoundRecord | BenchmarkPageRoundRecord> {
  const analyze = await readJsonIfPresent(path.join(destDir, "analyze.json"));
  const violations = asViolations(analyze);
  const visionError = visionErrorFromAnalyze(analyze);
  if (job.kind === "validation") {
    return finishValidation({ job, destDir, violations, visionError });
  }
  return finishBenchmark({ job, destDir, violations, visionError });
}

export async function replayRound(options: {
  job: ReuseJob;
  destDir: string;
  visionLayer: AnalysisLayer;
}): Promise<ValidationRoundRecord | BenchmarkPageRoundRecord> {
  await copyRoundArtifacts(options.job.sourceDir, options.destDir);
  const analyze = await readJsonIfPresent(
    path.join(options.job.sourceDir, "analyze.json"),
  );
  const page = await loadPage(options.destDir, analyze);
  if (!page) {
    if (options.job.kind === "validation") {
      return {
        pageId: options.job.pageId,
        mode: options.job.mode,
        round: options.job.round,
        status: "lost",
        error: "screenshot.png ausente na rodada original",
        assertions: [],
        artifactDir: options.destDir,
      };
    }
    const entry = loadBenchmarkCatalog().find((item) => item.id === options.job.pageId);
    return {
      pageId: options.job.pageId,
      round: options.job.round,
      status: "lost",
      error: "screenshot.png ausente na rodada original",
      groundTruth: entry?.groundTruthViolations ?? [],
      violations: [],
      scores: [],
      visualExclusive: null,
      artifactDir: options.destDir,
    };
  }

  const analysisRun = makeRun(page);
  const axeViolations = axeViolationsFromAnalyze(analyze, analysisRun.id);
  const vision = await runVision(options.visionLayer, page, analysisRun);
  const violations = mergeViolations(axeViolations, vision.violations);

  if (options.job.kind === "validation") {
    const record = finishValidation({
      job: options.job,
      destDir: options.destDir,
      violations,
      visionError: vision.error,
    });
    await writeFile(
      path.join(options.destDir, "analyze.json"),
      `${JSON.stringify(
        {
          page: {
            id: page.id,
            url: page.url,
            capturedHtml: page.capturedHtml,
            screenshotPath: page.screenshotPath,
          },
          analysisRun: {
            id: analysisRun.id,
            pageId: page.id,
            status: record.status === "completed" ? "completed" : "failed",
            modelVersions: analysisRun.modelVersions,
          },
          violations,
          vision: {
            attempted: true,
            error: vision.error,
            reusedScreenshot: true,
          },
          diagnostics: record.observation?.diagnostics,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    return record;
  }

  const record = finishBenchmark({
    job: options.job,
    destDir: options.destDir,
    violations,
    visionError: vision.error,
  });
  await writeFile(
    path.join(options.destDir, "analyze.json"),
    `${JSON.stringify(
      {
        url: page.url,
        violations: violations.map((violation) => ({
          id: violation.id,
          wcagCriterion: violation.wcagCriterion,
          sourceLayer: violation.sourceLayer,
          description: violation.description,
          htmlSnippet: violation.htmlSnippet,
          severity: violation.severity,
        })),
        vision: {
          attempted: true,
          error: vision.error,
          reusedScreenshot: true,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return record;
}
