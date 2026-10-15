import type {
  AnalysisLayer,
  BenchmarkCase,
  EvaluationResult,
  ModelVersions,
  Page,
} from "@mavi/shared";
import type { AnalysisStore } from "../db/analysisStore.ts";
import type { EvaluationResultStore } from "../db/evaluationResultStore.ts";
import { mergeViolations } from "../analysis/merge/mergeViolations.ts";
import {
  accumulateCategoryCounts,
  ratiosFromCounts,
  scoreAgainstGroundTruth,
  type CategoryCounts,
} from "./scoreAgainstGroundTruth.ts";

export interface BenchmarkCaseRun {
  benchmarkCase: BenchmarkCase;
  page: Page;
}

export interface BenchmarkRunReport {
  evaluatedAt: string;
  modelVersions: ModelVersions;
  precisionByCategory: Record<string, number>;
  recallByCategory: Record<string, number>;
  countsByCategory: Record<string, CategoryCounts>;
  results: EvaluationResult[];
}

export interface RunBenchmarkOptions {
  cases: BenchmarkCaseRun[];
  analysisStore: AnalysisStore;
  evaluationStore: EvaluationResultStore;
  axeLayer: AnalysisLayer;
  visionLayer: AnalysisLayer;
  modelVersions: ModelVersions;
  evaluatedAt?: Date;
}

/**
 * Percorre BenchmarkCase já persistidas, roda as camadas de análise
 * e grava um EvaluationResult por caso. Não passa pela UI.
 * Falha da camada visual interrompe a rodada: não vira falso negativo.
 */
export async function runBenchmark(
  options: RunBenchmarkOptions,
): Promise<BenchmarkRunReport> {
  const roundStartedAt = options.evaluatedAt ?? new Date();
  const results: EvaluationResult[] = [];
  const countsByCategory: Record<string, CategoryCounts> = {};

  for (const { benchmarkCase, page } of options.cases) {
    const analysisRun = options.analysisStore.saveAnalysisRun({
      pageId: page.id,
      status: "running",
      modelVersions: options.modelVersions,
      startedAt: roundStartedAt,
    });

    try {
      const axeViolations = await options.axeLayer.analyze(page, analysisRun);
      const visionViolations = await options.visionLayer.analyze(
        page,
        analysisRun,
      );
      const violations = options.analysisStore.saveViolations(
        mergeViolations(axeViolations, visionViolations),
      );
      const score = scoreAgainstGroundTruth(
        violations,
        benchmarkCase.groundTruthViolations,
      );
      accumulateCategoryCounts(countsByCategory, score.countsByCategory);
      results.push(
        options.evaluationStore.save({
          benchmarkCaseId: benchmarkCase.id,
          analysisRunId: analysisRun.id,
          truePositives: score.truePositives,
          falsePositives: score.falsePositives,
          falseNegatives: score.falseNegatives,
          precisionByCategory: score.precisionByCategory,
          recallByCategory: score.recallByCategory,
        }),
      );
      options.analysisStore.finishAnalysisRun(analysisRun.id, "completed");
    } catch (error) {
      options.analysisStore.finishAnalysisRun(analysisRun.id, "failed");
      throw error;
    }
  }

  const { precisionByCategory, recallByCategory } =
    ratiosFromCounts(countsByCategory);

  return {
    evaluatedAt: roundStartedAt.toISOString(),
    modelVersions: options.modelVersions,
    precisionByCategory,
    recallByCategory,
    countsByCategory,
    results,
  };
}
