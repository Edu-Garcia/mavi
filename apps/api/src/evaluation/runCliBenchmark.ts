import path from "node:path";
import type { AnalysisLayer, ModelVersions } from "@mavi/shared";
import { createAxeAnalysisLayer } from "../analysis/axe/axeAnalysisLayer.ts";
import { createDefaultVisionLayer } from "../analysis/vision/index.ts";
import { loadBenchmarkCatalog } from "../benchmark/loadBenchmarkCatalog.ts";
import { capturePage } from "../capture/capturePage.ts";
import { createAnalysisStore } from "../db/analysisStore.ts";
import { createBenchmarkCaseStore } from "../db/benchmarkCaseStore.ts";
import { createEvaluationResultStore } from "../db/evaluationResultStore.ts";
import { writeEvaluationExport } from "./exportEvaluation.ts";
import { buildModelVersions } from "./modelVersions.ts";
import {
  runBenchmark,
  type BenchmarkCaseRun,
  type BenchmarkRunReport,
} from "./runBenchmark.ts";

export interface CapturedBenchmarkPage {
  url: string;
  html: string;
  screenshotPath: string;
}

export type BenchmarkCapture = (
  sourcePath: string,
  screenshotDir: string,
) => Promise<CapturedBenchmarkPage>;

export interface RunCliBenchmarkOptions {
  dbPath: string;
  outDir: string;
  catalogRoot?: string;
  evaluatedAt?: Date;
  modelVersions?: ModelVersions;
  axeLayer?: AnalysisLayer;
  visionLayer?: AnalysisLayer;
  capture?: BenchmarkCapture;
}

async function defaultCapture(
  sourcePath: string,
  screenshotDir: string,
): Promise<CapturedBenchmarkPage> {
  const captured = await capturePage(sourcePath, { screenshotDir });
  return {
    url: captured.url,
    html: captured.html,
    screenshotPath: captured.screenshotPath,
  };
}

export function formatBenchmarkReport(report: BenchmarkRunReport): string {
  const versions = report.modelVersions;
  const lines = [
    `Avaliação ${report.evaluatedAt}`,
    `modelos: axe-core ${versions.axeCore ?? "-"}, gemini ${versions.gemini ?? "-"}, llama ${versions.llama ?? "-"}`,
    `prompts: visão ${versions.visionPrompt ?? "-"}, correção ${versions.fixPrompt ?? "-"}`,
    "categoria | precisão | recall",
  ];

  const categories = Object.keys(report.precisionByCategory).sort();
  if (categories.length === 0) {
    lines.push("(nenhuma categoria)");
  }

  for (const category of categories) {
    lines.push(
      `${category} | ${report.precisionByCategory[category] ?? 0} | ${report.recallByCategory[category] ?? 0}`,
    );
  }

  return lines.join("\n");
}

/**
 * Percorre o catálogo de BenchmarkCase, avalia cada página e exporta a rodada.
 * Não sobe servidor nem passa pela UI.
 */
export async function runCliBenchmark(
  options: RunCliBenchmarkOptions,
): Promise<BenchmarkRunReport> {
  const catalog = loadBenchmarkCatalog(options.catalogRoot);
  const screenshotDir = path.join(path.dirname(options.dbPath), "screenshots");
  const capture = options.capture ?? defaultCapture;
  const axeLayer = options.axeLayer ?? createAxeAnalysisLayer();
  const visionLayer =
    options.visionLayer ?? createDefaultVisionLayer({ missingKey: "throw" });
  const modelVersions =
    options.modelVersions ??
    buildModelVersions(process.env, { includeLlama: false });

  const benchmarkStore = await createBenchmarkCaseStore(options.dbPath);
  const analysisStore = await createAnalysisStore(options.dbPath);
  const evaluationStore = await createEvaluationResultStore(options.dbPath);

  try {
    const cases: BenchmarkCaseRun[] = [];
    for (const entry of catalog) {
      const captured = await capture(entry.pageHtmlPath, screenshotDir);
      const page = benchmarkStore.savePage({
        url: captured.url,
        capturedHtml: captured.html,
        screenshotPath: captured.screenshotPath,
      });
      const benchmarkCase = benchmarkStore.saveBenchmarkCase({
        pageId: page.id,
        groundTruthViolations: entry.groundTruthViolations,
      });
      cases.push({ benchmarkCase, page });
    }

    const report = await runBenchmark({
      cases,
      analysisStore,
      evaluationStore,
      axeLayer,
      visionLayer,
      modelVersions,
      evaluatedAt: options.evaluatedAt,
    });

    await writeEvaluationExport(report, options.outDir);
    return report;
  } finally {
    benchmarkStore.close();
    analysisStore.close();
    evaluationStore.close();
  }
}
