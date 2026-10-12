import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FixSuggestion } from "@mavi/shared";

export interface FixSuggestionStore {
  save(suggestion: FixSuggestion): FixSuggestion;
  getByViolationId(violationId: string): FixSuggestion | null;
  listByViolationIds(violationIds: string[]): FixSuggestion[];
  close(): void;
}

interface FixSuggestionRow {
  id: string;
  violation_id: string;
  diff_before: string;
  diff_after: string;
  explanation: string;
  generated_at: string;
}

function mapRow(row: FixSuggestionRow): FixSuggestion {
  return {
    id: row.id,
    violationId: row.violation_id,
    diffBefore: row.diff_before,
    diffAfter: row.diff_after,
    explanation: row.explanation,
    generatedAt: new Date(row.generated_at),
  };
}

export async function createFixSuggestionStore(
  dbPath: string,
): Promise<FixSuggestionStore> {
  await mkdir(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS fix_suggestions (
      id TEXT PRIMARY KEY NOT NULL,
      violation_id TEXT NOT NULL UNIQUE,
      diff_before TEXT NOT NULL,
      diff_after TEXT NOT NULL,
      explanation TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );
  `);

  return {
    save(suggestion) {
      db.prepare(
        `INSERT INTO fix_suggestions
          (id, violation_id, diff_before, diff_after, explanation, generated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(violation_id) DO UPDATE SET
           id = excluded.id,
           diff_before = excluded.diff_before,
           diff_after = excluded.diff_after,
           explanation = excluded.explanation,
           generated_at = excluded.generated_at`,
      ).run(
        suggestion.id,
        suggestion.violationId,
        suggestion.diffBefore,
        suggestion.diffAfter,
        suggestion.explanation,
        suggestion.generatedAt.toISOString(),
      );
      return suggestion;
    },

    getByViolationId(violationId) {
      const row = db
        .prepare(`SELECT * FROM fix_suggestions WHERE violation_id = ?`)
        .get(violationId) as FixSuggestionRow | undefined;
      return row ? mapRow(row) : null;
    },

    listByViolationIds(violationIds) {
      if (violationIds.length === 0) {
        return [];
      }
      const placeholders = violationIds.map(() => "?").join(", ");
      const rows = db
        .prepare(
          `SELECT * FROM fix_suggestions WHERE violation_id IN (${placeholders})`,
        )
        .all(...violationIds) as unknown as FixSuggestionRow[];
      return rows.map(mapRow);
    },

    close() {
      db.close();
    },
  };
}
