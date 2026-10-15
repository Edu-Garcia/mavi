import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  AnalysisRun,
  AnalysisRunStatus,
  ModelVersions,
  Page,
  SourceLayer,
  Violation,
  ViolationSeverity,
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
  startedAt?: Date;
}

export interface AnalysisRunWithPage {
  analysisRun: AnalysisRun;
  page: Page;
}

export interface AnalysisStore {
  savePage(input: SavePageInput): Page;
  saveAnalysisRun(input: SaveAnalysisRunInput): AnalysisRun;
  finishAnalysisRun(id: string, status: "completed" | "failed"): void;
  saveViolations(violations: Violation[]): Violation[];
  listViolationsByAnalysisRun(analysisRunId: string): Violation[];
  getPage(id: string): Page | null;
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

interface ViolationRow {
  id: string;
  analysis_run_id: string;
  wcag_criterion: string;
  source_layer: SourceLayer;
  description: string;
  html_snippet: string;
  severity: ViolationSeverity;
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

function mapViolation(row: ViolationRow): Violation {
  return {
    id: row.id,
    analysisRunId: row.analysis_run_id,
    wcagCriterion: row.wcag_criterion,
    sourceLayer: row.source_layer,
    description: row.description,
    htmlSnippet: row.html_snippet,
    severity: row.severity,
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

    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY NOT NULL,
      analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id),
      wcag_criterion TEXT NOT NULL,
      source_layer TEXT NOT NULL,
      description TEXT NOT NULL,
      html_snippet TEXT NOT NULL,
      severity TEXT NOT NULL
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
      const startedAt = input.startedAt ?? new Date();
      const completedAt =
        input.status === "completed" || input.status === "failed"
          ? new Date()
          : null;
      const analysisRun: AnalysisRun = {
        id: randomUUID(),
        pageId: input.pageId,
        status: input.status,
        startedAt,
        completedAt,
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

    finishAnalysisRun(id, status) {
      db.prepare(
        `UPDATE analysis_runs SET status = ?, completed_at = ? WHERE id = ?`,
      ).run(status, new Date().toISOString(), id);
    },

    saveViolations(violations) {
      const insert = db.prepare(
        `INSERT INTO violations
          (id, analysis_run_id, wcag_criterion, source_layer, description, html_snippet, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const violation of violations) {
        insert.run(
          violation.id,
          violation.analysisRunId,
          violation.wcagCriterion,
          violation.sourceLayer,
          violation.description,
          violation.htmlSnippet,
          violation.severity,
        );
      }
      return violations;
    },


    listViolationsByAnalysisRun(analysisRunId) {
      const rows = db
        .prepare(`SELECT * FROM violations WHERE analysis_run_id = ?`)
        .all(analysisRunId) as unknown as ViolationRow[];
      return rows.map(mapViolation);
    },


    getPage(id) {
      const pageRow = db
        .prepare(`SELECT * FROM pages WHERE id = ?`)
        .get(id) as PageRow | undefined;

      return pageRow ? mapPage(pageRow) : null;
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
