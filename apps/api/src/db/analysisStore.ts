import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  AnalysisRun,
  AnalysisRunStatus,
  ModelVersions,
  Page,
} from "@mavi/shared";

export interface SavePageInput {
  url: string;
  capturedHtml: string;
  screenshotPath: string;
}

export interface SaveAnalysisRunInput {
  pageId: string;
  status: AnalysisRunStatus;
  modelVersions?: ModelVersions;
}

export interface AnalysisRunWithPage {
  analysisRun: AnalysisRun;
  page: Page;
}

export interface AnalysisStore {
  savePage(input: SavePageInput): Page;
  saveAnalysisRun(input: SaveAnalysisRunInput): AnalysisRun;
  getAnalysisRun(id: string): AnalysisRunWithPage | null;
  close(): void;
}

interface PageRow {
  id: string;
  url: string;
  captured_html: string;
  screenshot_path: string;
  created_at: string;
}

interface AnalysisRunRow {
  id: string;
  page_id: string;
  status: AnalysisRunStatus;
  started_at: string;
  completed_at: string | null;
  model_versions: string;
}

function toIsoNow(): string {
  return new Date().toISOString();
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

function mapAnalysisRun(row: AnalysisRunRow): AnalysisRun {
  return {
    id: row.id,
    pageId: row.page_id,
    status: row.status,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    modelVersions: JSON.parse(row.model_versions) as ModelVersions,
  };
}

export async function createAnalysisStore(
  dbPath: string,
): Promise<AnalysisStore> {
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

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY NOT NULL,
      page_id TEXT NOT NULL REFERENCES pages(id),
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      model_versions TEXT NOT NULL
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

    saveAnalysisRun(input) {
      const now = toIsoNow();
      const completedAt =
        input.status === "completed" || input.status === "failed" ? now : null;
      const analysisRun: AnalysisRun = {
        id: randomUUID(),
        pageId: input.pageId,
        status: input.status,
        startedAt: new Date(now),
        completedAt: completedAt ? new Date(completedAt) : null,
        modelVersions: input.modelVersions ?? {},
      };

      db.prepare(
        `INSERT INTO analysis_runs
          (id, page_id, status, started_at, completed_at, model_versions)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        analysisRun.id,
        analysisRun.pageId,
        analysisRun.status,
        analysisRun.startedAt.toISOString(),
        analysisRun.completedAt?.toISOString() ?? null,
        JSON.stringify(analysisRun.modelVersions),
      );

      return analysisRun;
    },

    getAnalysisRun(id) {
      const runRow = db
        .prepare(`SELECT * FROM analysis_runs WHERE id = ?`)
        .get(id) as AnalysisRunRow | undefined;

      if (!runRow) {
        return null;
      }

      const pageRow = db
        .prepare(`SELECT * FROM pages WHERE id = ?`)
        .get(runRow.page_id) as PageRow | undefined;

      if (!pageRow) {
        return null;
      }

      return {
        analysisRun: mapAnalysisRun(runRow),
        page: mapPage(pageRow),
      };
    },

    close() {
      db.close();
    },
  };
}
