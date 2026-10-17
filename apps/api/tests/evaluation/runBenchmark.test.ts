import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AnalysisRun, Page, Violation } from "@mavi/shared";
import { createAnalysisStore, type AnalysisStore } from "../../src/db/analysisStore.ts";
import { createBenchmarkCaseStore } from "../../src/db/benchmarkCaseStore.ts";
import {
  createEvaluationResultStore,
  type EvaluationResultStore,
} from "../../src/db/evaluationResultStore.ts";
import { runBenchmark } from "../../src/evaluation/runBenchmark.ts";

const modelVersions = {
  axeCore: "4.10.0",
  gemini: "gemini-3.8-flash",
  llama: "llama-3.3-70b-versatile",
  visionPrompt: "prompts/vision-analysis.md#abc123def456",
  fixPrompt: "prompts/fix-generation.md#fff000aaa111",
};

function detected(
  analysisRun: AnalysisRun,
  partial: Pick<Violation, "id" | "wcagCriterion" | "htmlSnippet">,
): Violation {
  return {
    analysisRunId: analysisRun.id,
    sourceLayer: "axe",
    description: partial.htmlSnippet,
    severity: "serious",
    ...partial,
  };
}

describe("runBenchmark", () => {
  let dataDir: string;
  let analysisStore: AnalysisStore;
  let evaluationStore: EvaluationResultStore;
  let pages: { alt: Page; logo: Page };

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-run-"));
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const benchmarkStore = await createBenchmarkCaseStore(dbPath);
    analysisStore = await createAnalysisStore(dbPath);

    const alt = benchmarkStore.savePage({
      url: "file:///benchmark/pages/missing-alt.html",
      capturedHtml: "<html><img src='produto.jpg'><img src='hero.png'></html>",
      screenshotPath: path.join(dataDir, "missing-alt.png"),
    });
    const logo = benchmarkStore.savePage({
      url: "file:///benchmark/pages/logo.html",
      capturedHtml: "<html><img src='logo.png'></html>",
      screenshotPath: path.join(dataDir, "logo.png"),
    });
    pages = { alt, logo };

    benchmarkStore.saveBenchmarkCase({
      pageId: alt.id,
      groundTruthViolations: [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='hero.png']",
        },
      ],
    });
    benchmarkStore.saveBenchmarkCase({
      pageId: logo.id,
      groundTruthViolations: [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='logo.png']",
        },
      ],
    });
    benchmarkStore.close();
    evaluationStore = await createEvaluationResultStore(dbPath);
  });

  afterEach(async () => {
    analysisStore?.close();
    evaluationStore?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("avalia cada BenchmarkCase, persiste EvaluationResult e agrega precisão/recall", async () => {
    const benchmarkStore = await createBenchmarkCaseStore(
      path.join(dataDir, "mavi.sqlite"),
    );
    const cases = benchmarkStore.listBenchmarkCases().map((benchmarkCase) => {
      const page = benchmarkStore.getPage(benchmarkCase.pageId);
      if (!page) {
        throw new Error("Page ausente");
      }
      return { benchmarkCase, page };
    });
    benchmarkStore.close();

    const report = await runBenchmark({
      cases,
      analysisStore,
      evaluationStore,
      modelVersions,
      evaluatedAt: new Date("2026-10-12T21:00:00.000Z"),
      axeLayer: {
        analyze: async (page, analysisRun) => {
          if (page.id === pages.alt.id) {
            return [
              detected(analysisRun, {
                id: "v-produto",
                wcagCriterion: "1.1.1 Non-text Content",
                htmlSnippet: '<img src="produto.jpg">',
              }),
              detected(analysisRun, {
                id: "v-hero",
                wcagCriterion: "1.1.1 Non-text Content",
                htmlSnippet: '<img src="hero.png">',
              }),
            ];
          }
          return [
            detected(analysisRun, {
              id: "v-banner",
              wcagCriterion: "1.1.1 Non-text Content",
              htmlSnippet: '<img src="banner.png">',
            }),
          ];
        },
      },
      visionLayer: { analyze: async () => [] },
    });

    expect(report.results).toHaveLength(2);
    expect(report.evaluatedAt).toBe("2026-10-12T21:00:00.000Z");
    expect(report.precisionByCategory["1.1.1"]).toBeCloseTo(0.6667, 3);
    expect(report.recallByCategory["1.1.1"]).toBeCloseTo(0.6667, 3);

    const persisted = evaluationStore.list();
    expect(persisted).toHaveLength(2);
    expect(persisted.map((result) => result.analysisRunId).sort()).toEqual(
      report.results.map((result) => result.analysisRunId).sort(),
    );

    for (const result of report.results) {
      const loaded = analysisStore.getAnalysisRun(result.analysisRunId);
      expect(loaded?.analysisRun.status).toBe("completed");
      expect(loaded?.analysisRun.modelVersions).toEqual(modelVersions);
      expect(loaded?.analysisRun.startedAt.toISOString()).toBe(
        "2026-10-12T21:00:00.000Z",
      );
      expect(loaded?.analysisRun.completedAt).toBeInstanceOf(Date);
      expect(loaded?.analysisRun.status).toBe("completed");
    }
  });

  it("interrompe a rodada quando a camada vision falha, sem gravar EvaluationResult", async () => {
    const benchmarkStore = await createBenchmarkCaseStore(
      path.join(dataDir, "mavi.sqlite"),
    );
    const cases = benchmarkStore.listBenchmarkCases().map((benchmarkCase) => {
      const page = benchmarkStore.getPage(benchmarkCase.pageId);
      if (!page) {
        throw new Error("Page ausente");
      }
      return { benchmarkCase, page };
    });
    benchmarkStore.close();

    await expect(
      runBenchmark({
      cases,
      analysisStore,
      evaluationStore,
      modelVersions,
      axeLayer: {
        analyze: async (page, analysisRun) => {
          if (page.id === pages.alt.id) {
            return [
              detected(analysisRun, {
                id: "v-produto",
                wcagCriterion: "1.1.1 Non-text Content",
                htmlSnippet: '<img src="produto.jpg">',
              }),
              detected(analysisRun, {
                id: "v-hero",
                wcagCriterion: "1.1.1 Non-text Content",
                htmlSnippet: '<img src="hero.png">',
              }),
            ];
          }
          return [
            detected(analysisRun, {
              id: "v-logo",
              wcagCriterion: "1.1.1 Non-text Content",
              htmlSnippet: '<img src="logo.png">',
            }),
          ];
        },
      },
      visionLayer: {
        analyze: async () => {
          throw new Error("Gemini indisponível");
        },
      },
    }),
    ).rejects.toThrow("Gemini indisponível");

    expect(evaluationStore.list()).toHaveLength(0);
  });
});
