import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AnalysisRun, Page } from "@mavi/shared";
import { createAxeAnalysisLayer } from "../src/analysis/axe/axeAnalysisLayer.ts";

const missingAltHtmlPath = fileURLToPath(
  new URL("./fixtures/missing-alt.html", import.meta.url),
);
const headingOrderHtmlPath = fileURLToPath(
  new URL("./fixtures/heading-order.html", import.meta.url),
);

function stubRun(pageId: string): AnalysisRun {
  return {
    id: "run-1",
    pageId,
    status: "running",
    startedAt: new Date("2026-01-15T12:00:00.000Z"),
    completedAt: null,
    modelVersions: {},
  };
}

describe("AxeAnalysisLayer", () => {
  it("gera Violation 1.1.1 para página com img sem alt", async () => {
    const html = await readFile(missingAltHtmlPath, "utf8");
    const page: Page = {
      id: "page-missing-alt",
      url: "file:///missing-alt.html",
      capturedHtml: html,
      screenshotPath: "screenshots/unused.png",
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
    };

    const layer = createAxeAnalysisLayer();
    const violations = await layer.analyze(page, stubRun(page.id));

    const altViolation = violations.find((v) =>
      v.wcagCriterion.startsWith("1.1.1"),
    );
    expect(altViolation).toBeDefined();
    expect(altViolation?.sourceLayer).toBe("axe");
    expect(altViolation?.analysisRunId).toBe("run-1");
    expect(altViolation?.htmlSnippet.toLowerCase()).toContain("<img");
    expect(altViolation?.description.length).toBeGreaterThan(0);
    expect(["critical", "serious", "moderate", "minor"]).toContain(
      altViolation?.severity,
    );
  });

  it("gera Violation de ordem de heading quando h1 é seguido de h3", async () => {
    const html = await readFile(headingOrderHtmlPath, "utf8");
    const page: Page = {
      id: "page-heading-order",
      url: "file:///heading-order.html",
      capturedHtml: html,
      screenshotPath: "screenshots/unused.png",
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
    };

    const layer = createAxeAnalysisLayer();
    const violations = await layer.analyze(page, stubRun(page.id));

    const headingViolation = violations.find((v) =>
      v.wcagCriterion.startsWith("1.3.1"),
    );
    expect(headingViolation).toBeDefined();
    expect(headingViolation?.sourceLayer).toBe("axe");
    expect(headingViolation?.htmlSnippet.toLowerCase()).toMatch(/<h[13]/);
  });
});
