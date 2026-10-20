import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyzeMode,
  FailureCaseRecord,
  PrecisionCoverageSummary,
  ValidationAssertionResult,
  ValidationPageId,
  ValidationRoundRecord,
} from "./types.ts";

export interface ResumedState {
  ambiente: PrecisionCoverageSummary["ambiente"];
  rounds: number;
  validation: ValidationRoundRecord[];
  benchmark?: PrecisionCoverageSummary["benchmark"];
  failures: FailureCaseRecord[];
  choices: string[];
  fixtureDiff: string;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parseValidationCsv(csv: string): ValidationRoundRecord[] {
  const lines = csv.trim().split(/\r?\n/);
  const grouped = new Map<string, ValidationRoundRecord>();
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }
    const [
      pageId,
      mode,
      round,
      status,
      assertionId,
      expected,
      found,
      passed,
    ] = parseCsvLine(line);
    if (!pageId || !mode || !round) {
      continue;
    }
    const key = `${pageId}|${mode}|${round}`;
    const assertion: ValidationAssertionResult = {
      id: assertionId ?? "",
      expected: expected ?? "",
      found: found ?? "",
      passed: passed === "true",
    };
    const current = grouped.get(key);
    if (current) {
      current.assertions.push(assertion);
      continue;
    }
    grouped.set(key, {
      pageId: pageId as ValidationPageId,
      mode: mode as AnalyzeMode,
      round: Number(round),
      status: (status as ValidationRoundRecord["status"]) ?? "completed",
      assertions: [assertion],
      artifactDir: "",
    });
  }
  return [...grouped.values()];
}

export async function loadResume(dir: string): Promise<ResumedState> {
  const statePath = path.join(dir, "state.json");
  if (existsSync(statePath)) {
    return JSON.parse(await readFile(statePath, "utf8")) as ResumedState;
  }
  const ambiente = JSON.parse(
    await readFile(path.join(dir, "ambiente.json"), "utf8"),
  ) as PrecisionCoverageSummary["ambiente"];
  const validation = parseValidationCsv(
    await readFile(path.join(dir, "validacao.csv"), "utf8"),
  );
  const failures = existsSync(path.join(dir, "falhas.json"))
    ? (JSON.parse(await readFile(path.join(dir, "falhas.json"), "utf8")) as FailureCaseRecord[])
    : [];
  return {
    ambiente,
    rounds: 5,
    validation,
    failures,
    choices: [],
    fixtureDiff: "",
  };
}
