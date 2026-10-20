import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisLayer } from "@mavi/shared";
import {
  axeViolationsFromAnalyze,
  listReusableJobs,
  replayRound,
} from "../../src/evaluation/precisionCoverage/reuseScreenshots.ts";

describe("listReusableJobs", () => {
  it("lista 70 rodadas de validação e benchmark em 5 rounds", () => {
    const jobs = listReusableJobs("/tmp/campanha", 5);
    expect(jobs).toHaveLength(70);
    expect(jobs.filter((job) => job.kind === "validation")).toHaveLength(40);
    expect(jobs.filter((job) => job.kind === "benchmark")).toHaveLength(30);
  });
});

describe("axeViolationsFromAnalyze", () => {
  it("reabre só o que o axe já tinha achado, inclusive both", () => {
    const axe = axeViolationsFromAnalyze(
      {
        violations: [
          {
            wcagCriterion: "1.1.1 Non-text Content",
            sourceLayer: "axe",
            description: "sem alt",
            htmlSnippet: "<img>",
            severity: "serious",
          },
          {
            wcagCriterion: "1.4.3 Contrast (Minimum)",
            sourceLayer: "both",
            description: "contraste",
            htmlSnippet: "<p class='hero'>",
            severity: "serious",
          },
          {
            wcagCriterion: "2.5.5 Target Size",
            sourceLayer: "vision",
            description: "alvo",
            htmlSnippet: "botão",
            severity: "serious",
          },
        ],
      },
      "run-new",
    );
    expect(axe).toHaveLength(2);
    expect(axe.every((item) => item.sourceLayer === "axe")).toBe(true);
    expect(axe.map((item) => item.wcagCriterion)).toEqual([
      "1.1.1 Non-text Content",
      "1.4.3 Contrast (Minimum)",
    ]);
  });
});

describe("replayRound", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("manda o screenshot reutilizado à visão e re-scoreia o merge", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "mavi-reuse-"));
    const sourceDir = path.join(dir, "source");
    const destDir = path.join(dir, "dest");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, "screenshot.png"), "png-bytes");
    await writeFile(path.join(sourceDir, "captured.html"), "<html lang='pt'></html>");
    await writeFile(
      path.join(sourceDir, "analyze.json"),
      `${JSON.stringify({
        url: "file://missing-alt.html",
        violations: [
          {
            id: "old-axe",
            wcagCriterion: "1.1.1 Non-text Content",
            sourceLayer: "axe",
            description: "img sem alt",
            htmlSnippet: "<img src='x'>",
            severity: "serious",
          },
        ],
      })}\n`,
    );

    const seen: string[] = [];
    const visionLayer: AnalysisLayer = {
      async analyze(page) {
        seen.push(page.screenshotPath);
        return [
          {
            id: "vision-1",
            analysisRunId: "run",
            wcagCriterion: "1.4.3 Contrast (Minimum)",
            sourceLayer: "vision",
            description: "contraste",
            htmlSnippet: "hero",
            severity: "serious",
          },
        ];
      },
    };

    const record = await replayRound({
      job: {
        kind: "benchmark",
        pageId: "missing-alt",
        round: 1,
        sourceDir,
      },
      destDir,
      visionLayer,
    });

    expect(seen[0]).toBe(path.join(destDir, "screenshot.png"));
    expect(record.status).toBe("completed");
    if (record.artifactDir !== destDir) {
      throw new Error("artifactDir inesperado");
    }
    const analyze = JSON.parse(
      await readFile(path.join(destDir, "analyze.json"), "utf8"),
    ) as { violations: Array<{ sourceLayer: string }>; vision: { reusedScreenshot: boolean } };
    expect(analyze.vision.reusedScreenshot).toBe(true);
    expect(analyze.violations.map((item) => item.sourceLayer).sort()).toEqual([
      "axe",
      "vision",
    ]);
  });
});
