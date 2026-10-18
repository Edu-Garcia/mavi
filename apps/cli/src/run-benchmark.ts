import { loadEnv } from "@mavi/api/env";
import {
  formatBenchmarkReport,
  runCliBenchmark,
} from "@mavi/api/evaluation";

loadEnv();

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }
  return value;
}

const dbPath = readArg("--db") ?? "data/benchmark.sqlite";
const outDir = readArg("--out") ?? "benchmark/results";
const catalogRoot = readArg("--catalog");

const report = await runCliBenchmark({
  dbPath,
  outDir,
  catalogRoot,
});

console.log(formatBenchmarkReport(report));
console.log(`Exportado em ${outDir}`);
