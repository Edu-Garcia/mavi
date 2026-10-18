import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AxeBuilder } from "@axe-core/playwright";
import type { AnalysisLayer, AnalysisRun, Page, Violation } from "@mavi/shared";
import { chromium } from "playwright";
import { axeAnalyzedHtmlPath } from "./axeHtmlPath.ts";
import { localizeAxeDescription } from "./localizeAxeText.ts";
import {
  mapAxeImpactToSeverity,
  mapAxeTagsToWcagCriterion,
} from "./mapAxeToWcag.ts";

export function createAxeAnalysisLayer(options?: {
  htmlDir?: string;
}): AnalysisLayer {
  return {
    async analyze(page: Page, analysisRun: AnalysisRun): Promise<Violation[]> {
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        const browserPage = await context.newPage();
        await browserPage.setContent(page.capturedHtml, {
          waitUntil: "load",
        });

        const analyzedHtml = await browserPage.content();
        if (options?.htmlDir) {
          await mkdir(options.htmlDir, { recursive: true });
          await writeFile(
            axeAnalyzedHtmlPath(options.htmlDir, page.id),
            analyzedHtml,
            "utf8",
          );
        }

        const results = await new AxeBuilder({ page: browserPage }).analyze();

        const violations: Violation[] = [];
        for (const axeViolation of results.violations) {
          const wcagCriterion = mapAxeTagsToWcagCriterion(
            axeViolation.tags,
            axeViolation.id,
          );
          const severity = mapAxeImpactToSeverity(axeViolation.impact);

          for (const node of axeViolation.nodes) {
            violations.push({
              id: randomUUID(),
              analysisRunId: analysisRun.id,
              wcagCriterion,
              sourceLayer: "axe",
              description: localizeAxeDescription(
                axeViolation.id,
                axeViolation.help,
                node.failureSummary ?? axeViolation.description,
              ),
              htmlSnippet: node.html,
              severity,
            });
          }
        }

        return violations;
      } finally {
        await browser.close();
      }
    },
  };
}
