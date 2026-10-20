import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisLayer, Violation } from "@mavi/shared";
import { mergeViolations } from "../../analysis/merge/mergeViolations.ts";
import { loadBenchmarkCatalog } from "../../benchmark/loadBenchmarkCatalog.ts";
import { capturePage } from "../../capture/capturePage.ts";
import { createAnalysisStore } from "../../db/analysisStore.ts";
import { scoreAgainstGroundTruth } from "../scoreAgainstGroundTruth.ts";
import { buildModelVersions } from "../modelVersions.ts";
import {
  falsePositiveLabels,
  scoreByConfiguration,
} from "./scoreByConfiguration.ts";
import { saveCapturedPage } from "./saveArtifacts.ts";
import { scoreIncompleteVisualRound } from "./failureCases.ts";
import type {
  BenchmarkPageId,
  BenchmarkPageRoundRecord,
  BenchmarkPageScore,
  LayerConfiguration,
  PrecisionMode,
} from "./types.ts";
import { VISUAL_BENCHMARK_IDS } from "./types.ts";

const CONFIGS: LayerConfiguration[] = ["structural", "visual", "complete"];
const PRECISIONS: PrecisionMode[] = ["strict", "without-extras"];

function isBenchmarkPageId(id: string): id is BenchmarkPageId {
  return (
    id === "missing-alt" ||
    id === "heading-order" ||
    id === "empty-link" ||
    id === "missing-lang" ||
    id === "dynamic-contrast" ||
    id === "inadequate-touch-targets"
  );
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
        scoreAgainstGroundTruth([violation], [expected]).truePositives === 1
      ) {
        layers.push(violation.sourceLayer);
      }
    }
  }
  return [...new Set(layers)];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

async function analyzePage(
  sourcePath: string,
  screenshotDir: string,
  axeLayer: AnalysisLayer,
  visionLayer: AnalysisLayer,
  store: Awaited<ReturnType<typeof createAnalysisStore>>,
  modelVersions: ReturnType<typeof buildModelVersions>,
): Promise<{
  violations: Violation[];
  vision: { attempted: boolean; skippedReason?: string; error?: string };
  page: { capturedHtml: string; screenshotPath: string; url: string };
}> {
  const captured = await capturePage(sourcePath, { screenshotDir });
  const page = store.savePage({
    url: captured.url,
    capturedHtml: captured.html,
    screenshotPath: captured.screenshotPath,
  });
  const analysisRun = store.saveAnalysisRun({
    pageId: page.id,
    status: "running",
    modelVersions,
  });
  const axeViolations = await axeLayer.analyze(page, analysisRun);
  let visionViolations: Violation[] = [];
  const vision: {
    attempted: boolean;
    skippedReason?: string;
    error?: string;
  } = { attempted: false };
  try {
    visionViolations = await visionLayer.analyze(page, analysisRun);
    vision.attempted = true;
  } catch (error) {
    vision.attempted = true;
    vision.error = errorMessage(error);
  }
  const violations = store.saveViolations(
    mergeViolations(axeViolations, visionViolations),
  );
  store.finishAnalysisRun(
    analysisRun.id,
    vision.error ? "failed" : "completed",
  );
  return {
    violations,
    vision,
    page: {
      capturedHtml: page.capturedHtml,
      screenshotPath: page.screenshotPath,
      url: page.url,
    },
  };
}

export async function runBenchmarkCampaign(options: {
  rounds: number;
  outDir: string;
  catalogRoot?: string;
  axeLayer: AnalysisLayer;
  visionLayer: AnalysisLayer;
  dbPath: string;
  screenshotDir: string;
  setArtifactDir: (dir: string) => void;
  env?: NodeJS.ProcessEnv;
  pageDelayMs?: number;
}): Promise<BenchmarkPageRoundRecord[]> {
  const catalog = loadBenchmarkCatalog(options.catalogRoot);
  const store = await createAnalysisStore(options.dbPath);
  const modelVersions = buildModelVersions(options.env ?? process.env, {
    includeLlama: false,
  });
  const records: BenchmarkPageRoundRecord[] = [];

  try {
    for (let round = 1; round <= options.rounds; round += 1) {
      for (const entry of catalog) {
        if (!isBenchmarkPageId(entry.id)) {
          continue;
        }
        const artifactDir = path.join(
          options.outDir,
          "benchmark",
          entry.id,
          `round-${round}`,
        );
        await mkdir(artifactDir, { recursive: true });
        options.setArtifactDir(artifactDir);
        const record = await runOnePage({
          pageId: entry.id,
          sourcePath: entry.pageHtmlPath,
          round,
          artifactDir,
          axeLayer: options.axeLayer,
          visionLayer: options.visionLayer,
          store,
          screenshotDir: options.screenshotDir,
          modelVersions,
        });
        records.push(record);
        console.log(
          `[benchmark] ${entry.id} r${round} ${record.status} VP completo=${record.scores.find((item) => item.configuration === "complete" && item.precisionMode === "strict")?.score.truePositives}`,
        );
        const pageDelayMs = options.pageDelayMs ?? 2_000;
        if (pageDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
        }
      }
    }
  } finally {
    store.close();
  }

  return records;
}

async function runOnePage(options: {
  pageId: BenchmarkPageId;
  sourcePath: string;
  round: number;
  artifactDir: string;
  axeLayer: AnalysisLayer;
  visionLayer: AnalysisLayer;
  store: Awaited<ReturnType<typeof createAnalysisStore>>;
  screenshotDir: string;
  modelVersions: ReturnType<typeof buildModelVersions>;
}): Promise<BenchmarkPageRoundRecord> {
  const catalog = loadBenchmarkCatalog();
  const entry = catalog.find((item) => item.id === options.pageId);
  if (!entry) {
    throw new Error(`Página ${options.pageId} ausente do catálogo`);
  }

  const attempt = async () =>
    analyzePage(
      options.sourcePath,
      options.screenshotDir,
      options.axeLayer,
      options.visionLayer,
      options.store,
      options.modelVersions,
    );

  let lastError = "";
  for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
    try {
      const result = await attempt();
      await saveCapturedPage(options.artifactDir, result.page);
      await writeFile(
        path.join(options.artifactDir, "analyze.json"),
        `${JSON.stringify(
          {
            url: result.page.url,
            violations: result.violations.map((violation) => ({
              id: violation.id,
              wcagCriterion: violation.wcagCriterion,
              sourceLayer: violation.sourceLayer,
              description: violation.description,
              htmlSnippet: violation.htmlSnippet,
              severity: violation.severity,
            })),
            vision: result.vision,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const incomplete = scoreIncompleteVisualRound(
        result.violations,
        result.vision.skippedReason || result.vision.error
          ? {
              attempted: result.vision.attempted,
              skippedReason: result.vision.skippedReason,
              error: result.vision.error,
            }
          : { attempted: true },
      );

      if (
        incomplete.status === "incomplete" &&
        tryIndex === 0 &&
        /503|alta demanda/.test(incomplete.reason ?? "") &&
        !/429|limite de requisições/i.test(incomplete.reason ?? "")
      ) {
        lastError = incomplete.reason ?? "visão incompleta";
        continue;
      }

      const scores: BenchmarkPageScore[] = [];
      for (const configuration of CONFIGS) {
        for (const precisionMode of PRECISIONS) {
          scores.push({
            configuration,
            precisionMode,
            score: scoreByConfiguration(
              result.violations,
              entry.groundTruthViolations,
              configuration,
              precisionMode,
            ),
            falsePositiveRules: falsePositiveLabels(
              result.violations,
              entry.groundTruthViolations,
              configuration,
              precisionMode,
            ),
          });
        }
      }

      const structuralVp = scoreByConfiguration(
        result.violations,
        entry.groundTruthViolations,
        "structural",
        "strict",
      ).truePositives;
      const visualVp = scoreByConfiguration(
        result.violations,
        entry.groundTruthViolations,
        "visual",
        "strict",
      ).truePositives;
      const isVisualPage = (VISUAL_BENCHMARK_IDS as readonly string[]).includes(
        options.pageId,
      );

      return {
        pageId: options.pageId,
        round: options.round,
        status: incomplete.status === "incomplete" ? "incomplete" : "completed",
        error: incomplete.reason,
        groundTruth: entry.groundTruthViolations,
        violations: result.violations,
        scores,
        visualExclusive:
          incomplete.status === "incomplete" || !isVisualPage
            ? null
            : visualVp > 0 && structuralVp === 0,
        whoFound: whoFound(result.violations, options.pageId),
        artifactDir: options.artifactDir,
      };
    } catch (error) {
      lastError = errorMessage(error);
      await writeFile(
        path.join(options.artifactDir, `error-try-${tryIndex + 1}.txt`),
        lastError,
        "utf8",
      );
      if (tryIndex === 0) {
        await new Promise((resolve) => setTimeout(resolve, 8_000));
      }
    }
  }

  return {
    pageId: options.pageId,
    round: options.round,
    status: "lost",
    error: lastError,
    groundTruth: entry.groundTruthViolations,
    violations: [],
    scores: [],
    visualExclusive: null,
    artifactDir: options.artifactDir,
  };
}
