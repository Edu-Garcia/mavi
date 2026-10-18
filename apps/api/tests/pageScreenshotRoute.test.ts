import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.ts";
import {
  createAnalysisStore,
  type AnalysisStore,
} from "../src/db/analysisStore.ts";

/** Minimal valid 1×1 PNG */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("GET /pages/:pageId/screenshot", () => {
  let dataDir: string;
  let app: FastifyInstance;
  let store: AnalysisStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-screenshot-"));
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const screenshotDir = path.join(dataDir, "screenshots");
    store = await createAnalysisStore(dbPath);
    const axeHtmlDir = path.join(dataDir, "axe-html");
    app = await buildApp({ store, screenshotDir, axeHtmlDir });
  });

  afterEach(async () => {
    await app?.close();
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("serve o PNG da Page persistida", async () => {
    const screenshotPath = path.join(dataDir, "shot.png");
    await writeFile(screenshotPath, PNG_BYTES);

    const page = store.savePage({
      url: "file:///tmp/sample.html",
      capturedHtml: "<html><body>ok</body></html>",
      screenshotPath,
    });

    const response = await app.inject({
      method: "GET",
      url: `/pages/${page.id}/screenshot`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/image\/png/);
    expect(Buffer.from(response.rawPayload)).toEqual(PNG_BYTES);
  });

  it("retorna 404 quando a Page não existe", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pages/missing-id/screenshot",
    });

    expect(response.statusCode).toBe(404);
  });

  it("serve o HTML analisado pelo axe", async () => {
    const screenshotPath = path.join(dataDir, "shot.png");
    await writeFile(screenshotPath, PNG_BYTES);

    const page = store.savePage({
      url: "file:///tmp/sample.html",
      capturedHtml: "<html><body>ok</body></html>",
      screenshotPath,
    });
    const axeHtmlDir = path.join(dataDir, "axe-html");
    await mkdir(axeHtmlDir, { recursive: true });
    await writeFile(
      path.join(axeHtmlDir, `axe-${page.id}.html`),
      "<html><body>html analisado pelo axe</body></html>",
      "utf8",
    );

    const response = await app.inject({
      method: "GET",
      url: `/pages/${page.id}/axe-html`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.body).toContain("html analisado pelo axe");
  });

  it("retorna 404 quando o HTML do axe ainda não existe", async () => {
    const screenshotPath = path.join(dataDir, "shot.png");
    await writeFile(screenshotPath, PNG_BYTES);
    const page = store.savePage({
      url: "file:///tmp/sample.html",
      capturedHtml: "<html><body>ok</body></html>",
      screenshotPath,
    });

    const response = await app.inject({
      method: "GET",
      url: `/pages/${page.id}/axe-html`,
    });

    expect(response.statusCode).toBe(404);
  });
});
