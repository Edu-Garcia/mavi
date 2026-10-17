import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisRun, Page } from "@mavi/shared";
import { createDefaultVisionLayer } from "../../src/analysis/vision/createDefaultVisionLayer.ts";
import { loadBenchmarkCatalog } from "../../src/benchmark/loadBenchmarkCatalog.ts";
import { createEvaluationResultStore } from "../../src/db/evaluationResultStore.ts";
import {
  formatBenchmarkReport,
  runCliBenchmark,
} from "../../src/evaluation/runCliBenchmark.ts";

describe("runCliBenchmark", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("percorre todas as BenchmarkCase do catálogo, persiste a rodada e exporta JSON/CSV", async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-cli-"));
    const catalog = loadBenchmarkCatalog();
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const outDir = path.join(dataDir, "results");
    const analyzed: string[] = [];

    const report = await runCliBenchmark({
      dbPath,
      outDir,
      evaluatedAt: new Date("2026-10-12T21:00:00.000Z"),
      modelVersions: {
        axeCore: "4.10.0",
        gemini: "gemini-3.8-flash",
        visionPrompt: "prompts/vision-analysis.md#abc123def456",
        fixPrompt: "prompts/fix-generation.md#fff000aaa111",
      },
      axeLayer: {
        analyze: async (page) => {
          analyzed.push(page.url);
          return [];
        },
      },
      visionLayer: { analyze: async () => [] },
      capture: async (sourcePath) => ({
        url: `file://${sourcePath.replace(/\\/g, "/")}`,
        html: await readFile(sourcePath, "utf8"),
        screenshotPath: path.join(dataDir, "shot.png"),
      }),
    });

    expect(analyzed).toHaveLength(catalog.length);
    expect(report.results).toHaveLength(catalog.length);
    expect(report.evaluatedAt).toBe("2026-10-12T21:00:00.000Z");
    expect(report.recallByCategory["1.1.1"]).toBe(0);
    expect(report.modelVersions.visionPrompt).toBe(
      "prompts/vision-analysis.md#abc123def456",
    );

    const store = await createEvaluationResultStore(dbPath);
    expect(store.list()).toHaveLength(catalog.length);
    store.close();

    const json = JSON.parse(
      await readFile(path.join(outDir, "evaluation.json"), "utf8"),
    ) as { results: unknown[]; evaluatedAt: string };
    const csv = await readFile(path.join(outDir, "evaluation.csv"), "utf8");
    expect(json.results).toHaveLength(catalog.length);
    expect(json.evaluatedAt).toBe("2026-10-12T21:00:00.000Z");
    expect(csv).toContain("1.1.1");
    expect(formatBenchmarkReport(report)).toContain("1.1.1");
    expect(formatBenchmarkReport(report)).toContain("precisão");
  });

  it("recusa a rodada sem GEMINI_API_KEY em vez de zerar o recall visual", async () => {
    const layer = createDefaultVisionLayer({ missingKey: "throw", env: {} });
    const page: Page = {
      id: "page-1",
      url: "file:///benchmark/pages/dynamic-contrast.html",
      capturedHtml: "<html></html>",
      screenshotPath: "shot.png",
      createdAt: new Date("2026-10-12T21:00:00.000Z"),
    };
    const analysisRun: AnalysisRun = {
      id: "run-1",
      pageId: page.id,
      status: "running",
      startedAt: new Date("2026-10-12T21:00:00.000Z"),
      completedAt: null,
      modelVersions: {},
    };

    await expect(layer.analyze(page, analysisRun)).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });
});
