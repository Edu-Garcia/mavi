import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { BenchmarkCase, GroundTruthViolation, Page } from "@mavi/shared";

export interface SavePageInput {
  url: string;
  capturedHtml: string;
  screenshotPath: string;
}

export interface SaveBenchmarkCaseInput {
  pageId: string;
  groundTruthViolations: GroundTruthViolation[];
}

export interface BenchmarkCaseStore {
  savePage(input: SavePageInput): Page;
  getPage(id: string): Page | null;
  saveBenchmarkCase(input: SaveBenchmarkCaseInput): BenchmarkCase;
  getBenchmarkCase(id: string): BenchmarkCase | null;
  listBenchmarkCases(): BenchmarkCase[];
  close(): void;
}

interface PageRow {
  id: string;
  url: string;
  captured_html: string;
  screenshot_path: string;
  created_at: string;
}

interface BenchmarkCaseRow {
  id: string;
  page_id: string;
  ground_truth_violations: string;
}

function mapPage(row: PageRow): Page {
  return {
    id: row.id,
    url: row.url,
    capturedHtml: row.captured_html,
    screenshotPath: row.screenshot_path,
    createdAt: new Date(row.created_at),
  };
}

function mapBenchmarkCase(row: BenchmarkCaseRow): BenchmarkCase {
  return {
    id: row.id,
    pageId: row.page_id,
    groundTruthViolations: JSON.parse(
      row.ground_truth_violations,
    ) as GroundTruthViolation[],
  };
}

export async function createBenchmarkCaseStore(
  dbPath: string,
): Promise<BenchmarkCaseStore> {
  await mkdir(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL,
      captured_html TEXT NOT NULL,
      screenshot_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmark_cases (
      id TEXT PRIMARY KEY NOT NULL,
      page_id TEXT NOT NULL REFERENCES pages(id),
      ground_truth_violations TEXT NOT NULL
    );
  `);

  return {
    savePage(input) {
      const page: Page = {
        id: randomUUID(),
        url: input.url,
        capturedHtml: input.capturedHtml,
        screenshotPath: input.screenshotPath,
        createdAt: new Date(),
      };

      db.prepare(
        `INSERT INTO pages (id, url, captured_html, screenshot_path, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        page.id,
        page.url,
        page.capturedHtml,
        page.screenshotPath,
        page.createdAt.toISOString(),
      );

      return page;
    },

    getPage(id) {
      const row = db
        .prepare(`SELECT * FROM pages WHERE id = ?`)
        .get(id) as PageRow | undefined;
      return row ? mapPage(row) : null;
    },

    saveBenchmarkCase(input) {
      const benchmarkCase: BenchmarkCase = {
        id: randomUUID(),
        pageId: input.pageId,
        groundTruthViolations: input.groundTruthViolations,
      };

      db.prepare(
        `INSERT INTO benchmark_cases (id, page_id, ground_truth_violations)
         VALUES (?, ?, ?)`,
      ).run(
        benchmarkCase.id,
        benchmarkCase.pageId,
        JSON.stringify(benchmarkCase.groundTruthViolations),
      );

      return benchmarkCase;
    },

    getBenchmarkCase(id) {
      const row = db
        .prepare(`SELECT * FROM benchmark_cases WHERE id = ?`)
        .get(id) as BenchmarkCaseRow | undefined;
      return row ? mapBenchmarkCase(row) : null;
    },

    listBenchmarkCases() {
      const rows = db
        .prepare(`SELECT * FROM benchmark_cases`)
        .all() as unknown as BenchmarkCaseRow[];
      return rows.map(mapBenchmarkCase);
    },

    close() {
      db.close();
    },
  };
}
