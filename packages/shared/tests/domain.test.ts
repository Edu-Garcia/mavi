import { describe, expect, it } from "vitest";
import type {
  AnalysisLayer,
  AnalysisRun,
  BenchmarkCase,
  EvaluationResult,
  FixSuggestion,
  Page,
  Violation,
} from "@mavi/shared";

describe("vocabulário de domínio", () => {
  it("permite implementar uma AnalysisLayer que devolve Violation[]", async () => {
    const page: Page = {
      id: "page-1",
      url: "https://example.com",
      capturedHtml: "<html><img></html>",
      screenshotPath: "screenshots/page-1.png",
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
    };

    const run: AnalysisRun = {
      id: "run-1",
      pageId: page.id,
      status: "running",
      startedAt: new Date("2026-01-15T12:00:00.000Z"),
      completedAt: null,
      modelVersions: {},
    };

    const layer: AnalysisLayer = {
      analyze: async (capturedPage, analysisRun) => {
        const violation: Violation = {
          id: "violation-1",
          analysisRunId: analysisRun.id,
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "Imagem sem texto alternativo",
          htmlSnippet: "<img>",
          severity: "critical",
        };

        return capturedPage.capturedHtml.includes("<img>") ? [violation] : [];
      },
    };

    const violations = await layer.analyze(page, run);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.analysisRunId).toBe("run-1");
    expect(violations[0]?.wcagCriterion).toBe("1.1.1 Non-text Content");
    expect(violations[0]?.sourceLayer).toBe("axe");
  });

  it("expõe Page, AnalysisRun, FixSuggestion, BenchmarkCase e EvaluationResult", () => {
    const run: AnalysisRun = {
      id: "run-1",
      pageId: "page-1",
      status: "completed",
      startedAt: new Date("2026-01-15T12:00:00.000Z"),
      completedAt: new Date("2026-01-15T12:00:30.000Z"),
      modelVersions: {
        gemini: "gemini-2.5-flash",
        llama: "llama-3.3-70b",
        axeCore: "4.10.0",
      },
    };

    const fix: FixSuggestion = {
      id: "fix-1",
      violationId: "violation-1",
      diffBefore: "<img>",
      diffAfter: '<img alt="Foto do produto">',
      explanation: "Incluir texto alternativo descritivo.",
      generatedAt: new Date("2026-01-15T12:00:45.000Z"),
    };

    const benchmark: BenchmarkCase = {
      id: "bench-1",
      pageId: "page-1",
      groundTruthViolations: [
        { wcagCriterion: "1.1.1 Non-text Content", location: "img" },
      ],
    };

    const evaluation: EvaluationResult = {
      id: "eval-1",
      benchmarkCaseId: "bench-1",
      analysisRunId: "run-1",
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      precisionByCategory: { "1.1.1": 1 },
      recallByCategory: { "1.1.1": 1 },
    };

    expect(run.pageId).toBe("page-1");
    expect(fix.diffAfter).toBe('<img alt="Foto do produto">');
    expect(benchmark.groundTruthViolations).toEqual([
      { wcagCriterion: "1.1.1 Non-text Content", location: "img" },
    ]);
    expect(evaluation.truePositives).toBe(1);
  });
});
