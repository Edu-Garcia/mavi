import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BenchmarkRunReport } from "../../src/evaluation/runBenchmark.ts";
import { writeEvaluationExport } from "../../src/evaluation/exportEvaluation.ts";

const report: BenchmarkRunReport = {
  evaluatedAt: "2026-10-12T21:00:00.000Z",
  modelVersions: {
    axeCore: "4.10.0",
    gemini: "gemini-3.8-flash",
    llama: "llama-3.3-70b-versatile",
    visionPrompt: "prompts/vision-analysis.md#abc123def456",
    fixPrompt: "prompts/fix-generation.md#fff000aaa111",
  },
  precisionByCategory: { "1.1.1": 2 / 3, "1.4.3": 1 },
  recallByCategory: { "1.1.1": 2 / 3, "1.4.3": 1 },
  countsByCategory: {
    "1.1.1": { truePositives: 2, falsePositives: 1, falseNegatives: 1 },
    "1.4.3": { truePositives: 1, falsePositives: 0, falseNegatives: 0 },
  },
  results: [
    {
      id: "eval-1",
      benchmarkCaseId: "case-1",
      analysisRunId: "run-1",
      truePositives: 2,
      falsePositives: 1,
      falseNegatives: 1,
      precisionByCategory: { "1.1.1": 2 / 3 },
      recallByCategory: { "1.1.1": 2 / 3 },
    },
  ],
};

describe("writeEvaluationExport", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("grava JSON e CSV com precisão/recall, versões e timestamp", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "mavi-export-"));
    const written = await writeEvaluationExport(report, outDir);

    const json = JSON.parse(await readFile(written.jsonPath, "utf8")) as BenchmarkRunReport;
    expect(json.evaluatedAt).toBe("2026-10-12T21:00:00.000Z");
    expect(json.modelVersions).toEqual(report.modelVersions);
    expect(json.precisionByCategory["1.1.1"]).toBeCloseTo(0.6667, 3);
    expect(json.recallByCategory["1.4.3"]).toBe(1);
    expect(json.results).toHaveLength(1);

    const csv = await readFile(written.csvPath, "utf8");
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "evaluatedAt,gemini,llama,axeCore,visionPrompt,fixPrompt,category,precision,recall",
    );
    expect(lines).toHaveLength(3);
    expect(csv).toContain("2026-10-12T21:00:00.000Z");
    expect(csv).toContain("prompts/vision-analysis.md#abc123def456");
    expect(csv).toContain("prompts/fix-generation.md#fff000aaa111");
    expect(csv).toContain("gemini-3.8-flash");
    expect(csv).toContain("1.1.1");
    expect(csv).toContain("1.4.3");
  });
});
