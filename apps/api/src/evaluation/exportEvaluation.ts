import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkRunReport } from "./runBenchmark.ts";

const CSV_HEADER = [
  "evaluatedAt",
  "gemini",
  "llama",
  "axeCore",
  "visionPrompt",
  "fixPrompt",
  "category",
  "precision",
  "recall",
].join(",");

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function evaluationReportToJson(report: BenchmarkRunReport): string {
  const exported = {
    evaluatedAt: report.evaluatedAt,
    modelVersions: report.modelVersions,
    precisionByCategory: report.precisionByCategory,
    recallByCategory: report.recallByCategory,
    results: report.results,
  };
  return `${JSON.stringify(exported, null, 2)}\n`;
}

export function evaluationReportToCsv(report: BenchmarkRunReport): string {
  const versions = report.modelVersions;
  const categories = Object.keys(report.precisionByCategory).sort();
  const rows = categories.map((category) => {
    return [
      report.evaluatedAt,
      versions.gemini ?? "",
      versions.llama ?? "",
      versions.axeCore ?? "",
      versions.visionPrompt ?? "",
      versions.fixPrompt ?? "",
      category,
      report.precisionByCategory[category] ?? 0,
      report.recallByCategory[category] ?? 0,
    ]
      .map(csvCell)
      .join(",");
  });

  return `${[CSV_HEADER, ...rows].join("\n")}\n`;
}

export async function writeEvaluationExport(
  report: BenchmarkRunReport,
  outDir: string,
): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "evaluation.json");
  const csvPath = path.join(outDir, "evaluation.csv");
  await writeFile(jsonPath, evaluationReportToJson(report), "utf8");
  await writeFile(csvPath, evaluationReportToCsv(report), "utf8");
  return { jsonPath, csvPath };
}
