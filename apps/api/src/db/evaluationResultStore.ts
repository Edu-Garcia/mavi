import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { EvaluationResult, WcagCriterion } from "@mavi/shared";

export interface SaveEvaluationResultInput {
  benchmarkCaseId: string;
  analysisRunId: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precisionByCategory: Record<WcagCriterion, number>;
  recallByCategory: Record<WcagCriterion, number>;
}

export interface EvaluationResultStore {
  save(input: SaveEvaluationResultInput): EvaluationResult;
  get(id: string): EvaluationResult | null;
  list(): EvaluationResult[];
  close(): void;
}

interface EvaluationResultRow {
  id: string;
  benchmark_case_id: string;
  analysis_run_id: string;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision_by_category: string;
  recall_by_category: string;
}

function mapEvaluationResult(row: EvaluationResultRow): EvaluationResult {
  return {
    id: row.id,
    benchmarkCaseId: row.benchmark_case_id,
    analysisRunId: row.analysis_run_id,
    truePositives: row.true_positives,
    falsePositives: row.false_positives,
    falseNegatives: row.false_negatives,
    precisionByCategory: JSON.parse(row.precision_by_category) as Record<
      WcagCriterion,
      number
    >,
    recallByCategory: JSON.parse(row.recall_by_category) as Record<
      WcagCriterion,
      number
    >,
  };
}

export async function createEvaluationResultStore(
  dbPath: string,
): Promise<EvaluationResultStore> {
  await mkdir(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS evaluation_results (
      id TEXT PRIMARY KEY NOT NULL,
      benchmark_case_id TEXT NOT NULL REFERENCES benchmark_cases(id),
      analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id),
      true_positives INTEGER NOT NULL,
      false_positives INTEGER NOT NULL,
      false_negatives INTEGER NOT NULL,
      precision_by_category TEXT NOT NULL,
      recall_by_category TEXT NOT NULL
    );
  `);

  return {
    save(input) {
      const result: EvaluationResult = {
        id: randomUUID(),
        benchmarkCaseId: input.benchmarkCaseId,
        analysisRunId: input.analysisRunId,
        truePositives: input.truePositives,
        falsePositives: input.falsePositives,
        falseNegatives: input.falseNegatives,
        precisionByCategory: input.precisionByCategory,
        recallByCategory: input.recallByCategory,
      };

      db.prepare(
        `INSERT INTO evaluation_results (
          id, benchmark_case_id, analysis_run_id,
          true_positives, false_positives, false_negatives,
          precision_by_category, recall_by_category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        result.id,
        result.benchmarkCaseId,
        result.analysisRunId,
        result.truePositives,
        result.falsePositives,
        result.falseNegatives,
        JSON.stringify(result.precisionByCategory),
        JSON.stringify(result.recallByCategory),
      );

      return result;
    },

    get(id) {
      const row = db
        .prepare(`SELECT * FROM evaluation_results WHERE id = ?`)
        .get(id) as EvaluationResultRow | undefined;
      return row ? mapEvaluationResult(row) : null;
    },

    list() {
      const rows = db
        .prepare(`SELECT * FROM evaluation_results`)
        .all() as unknown as EvaluationResultRow[];
      return rows.map(mapEvaluationResult);
    },

    close() {
      db.close();
    },
  };
}
