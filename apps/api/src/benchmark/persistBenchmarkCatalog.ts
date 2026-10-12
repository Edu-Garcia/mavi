import path from "node:path";
import type { BenchmarkCase } from "@mavi/shared";
import type { BenchmarkCaseStore } from "../db/benchmarkCaseStore.ts";
import type { BenchmarkCatalogEntry } from "./loadBenchmarkCatalog.ts";

/**
 * Persists each catalog entry as a Page + BenchmarkCase with ground truth.
 * Screenshot path is a placeholder until a capture run fills a real image.
 */
export async function persistBenchmarkCatalog(
  catalog: BenchmarkCatalogEntry[],
  store: BenchmarkCaseStore,
): Promise<BenchmarkCase[]> {
  const cases: BenchmarkCase[] = [];

  for (const entry of catalog) {
    const page = store.savePage({
      url: `file://${entry.pageHtmlPath.replace(/\\/g, "/")}`,
      capturedHtml: entry.pageHtml,
      screenshotPath: path.join("benchmark", "screenshots", `${entry.id}.png`),
    });

    const benchmarkCase = store.saveBenchmarkCase({
      pageId: page.id,
      groundTruthViolations: entry.groundTruthViolations,
    });

    cases.push(benchmarkCase);
  }

  return cases;
}
