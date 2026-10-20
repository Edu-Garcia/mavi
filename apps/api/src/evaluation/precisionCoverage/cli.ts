import { loadEnv } from "../../env/loadEnv.ts";
import { runPrecisionCoverage } from "./runPrecisionCoverage.ts";

loadEnv();

process.on("uncaughtException", (error) => {
  console.error("[fatal] uncaughtException", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection", reason);
  process.exit(1);
});

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const rounds = Number(readArg("--rounds") ?? "5");
if (!Number.isFinite(rounds) || rounds < 1) {
  throw new Error("--rounds deve ser um inteiro ≥ 1");
}

const rpm = Number(readArg("--rpm") ?? "15");
const rpd = Number(readArg("--rpd") ?? "500");
if (!Number.isFinite(rpm) || rpm < 1 || !Number.isFinite(rpd) || rpd < 1) {
  throw new Error("--rpm e --rpd devem ser inteiros ≥ 1");
}

const summary = await runPrecisionCoverage({
  rounds,
  outDir: readArg("--out"),
  resumeFrom: readArg("--resume"),
  reuseScreenshotsFrom: readArg("--reuse-screenshots"),
  rpm,
  rpd,
  skipValidation: hasFlag("--skip-validation"),
  skipBenchmark: hasFlag("--skip-benchmark"),
  skipFailures: hasFlag("--skip-failures"),
});

console.log("");
console.log(`Campanha gravada em ${summary.outDir}`);
console.log(`Validação: ${summary.validation.length} registros`);
console.log(`Benchmark: ${summary.benchmark.length} registros`);
console.log(
  `Falhas de saída: ${summary.failures.filter((item) => !item.passed).length}/${summary.failures.length} falharam`,
);
