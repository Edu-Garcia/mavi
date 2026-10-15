import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAnalysisStore } from "../../src/db/analysisStore.ts";
import { createBenchmarkCaseStore } from "../../src/db/benchmarkCaseStore.ts";
import {
  createEvaluationResultStore,
  type EvaluationResultStore,
} from "../../src/db/evaluationResultStore.ts";

describe("EvaluationResultStore", () => {
  let dataDir: string;
  let store: EvaluationResultStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-eval-"));
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const benchmarkStore = await createBenchmarkCaseStore(dbPath);
    const analysisStore = await createAnalysisStore(dbPath);
    const page = benchmarkStore.savePage({
      url: "file:///benchmark/pages/missing-alt.html",
      capturedHtml: "<html><img src='produto.jpg'></html>",
      screenshotPath: "/tmp/missing-alt.png",
    });
    const benchmarkCase = benchmarkStore.saveBenchmarkCase({
      pageId: page.id,
      groundTruthViolations: [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
      ],
    });
    const analysisRun = analysisStore.saveAnalysisRun({
      pageId: page.id,
      status: "completed",
      modelVersions: { axeCore: "4.10.0" },
    });
    benchmarkStore.close();
    analysisStore.close();

    store = await createEvaluationResultStore(dbPath);
    store.save({
      benchmarkCaseId: benchmarkCase.id,
      analysisRunId: analysisRun.id,
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 1,
      precisionByCategory: { "1.1.1": 1 },
      recallByCategory: { "1.1.1": 0.5 },
    });
  });

  afterEach(async () => {
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persiste EvaluationResult da rodada e permite recuperá-lo", () => {
    const listed = store.list();
    expect(listed).toHaveLength(1);

    const loaded = store.get(listed[0]!.id);
    expect(loaded).toMatchObject({
      benchmarkCaseId: listed[0]!.benchmarkCaseId,
      analysisRunId: listed[0]!.analysisRunId,
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 1,
      precisionByCategory: { "1.1.1": 1 },
      recallByCategory: { "1.1.1": 0.5 },
    });
  });
});
