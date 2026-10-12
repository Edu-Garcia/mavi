import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GroundTruthViolation } from "@mavi/shared";

export interface BenchmarkCatalogEntry {
  id: string;
  pageHtmlPath: string;
  pageHtml: string;
  groundTruthViolations: GroundTruthViolation[];
}

interface GroundTruthFile {
  groundTruthViolations: GroundTruthViolation[];
}

function defaultCatalogRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../benchmark");
}

/**
 * Loads the on-disk benchmark catalog (`benchmark/pages` + `benchmark/ground-truth`).
 * Each HTML page must have a matching `{id}.json` gabarito.
 */
export function loadBenchmarkCatalog(
  catalogRoot: string = defaultCatalogRoot(),
): BenchmarkCatalogEntry[] {
  const pagesDir = path.join(catalogRoot, "pages");
  const groundTruthDir = path.join(catalogRoot, "ground-truth");

  const htmlFiles = readdirSync(pagesDir)
    .filter((name) => name.endsWith(".html"))
    .sort();

  return htmlFiles.map((fileName) => {
    const id = fileName.replace(/\.html$/, "");
    const pageHtmlPath = path.join(pagesDir, fileName);
    const groundTruthPath = path.join(groundTruthDir, `${id}.json`);
    const pageHtml = readFileSync(pageHtmlPath, "utf8");
    const parsed = JSON.parse(
      readFileSync(groundTruthPath, "utf8"),
    ) as GroundTruthFile;

    return {
      id,
      pageHtmlPath,
      pageHtml,
      groundTruthViolations: parsed.groundTruthViolations,
    };
  });
}
