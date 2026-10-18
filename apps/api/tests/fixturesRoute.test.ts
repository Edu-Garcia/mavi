import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { capturePage } from "../src/capture/capturePage.ts";
import { buildApp } from "../src/server.ts";
import {
  createAnalysisStore,
  type AnalysisStore,
} from "../src/db/analysisStore.ts";
import { findRepoRoot } from "../src/env/loadEnv.ts";

describe("GET /fixtures", () => {
  let dataDir: string;
  let app: FastifyInstance;
  let store: AnalysisStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-fixtures-"));
    store = await createAnalysisStore(path.join(dataDir, "mavi.sqlite"));
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      env: {},
      generateFixes: async () => [],
    });
  });

  afterEach(async () => {
    await app?.close();
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("serve página de validação como text/html", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/fixtures/validation/02-somente-visuais.html",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.body).toContain("Somente erros visuais");
  });

  it("serve página de benchmark e rejeita path traversal", async () => {
    const ok = await app.inject({
      method: "GET",
      url: "/fixtures/benchmark/missing-alt.html",
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain("<img");

    const traversal = await app.inject({
      method: "GET",
      url: "/fixtures/benchmark/..%2Fpackage.json",
    });
    expect(traversal.statusCode).toBeGreaterThanOrEqual(400);

    expect(findRepoRoot()).toContain("mavi");
  });

  it("permite ao Playwright capturar a fixture via HTTP", async () => {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("endereço do servidor de teste inválido");
    }
    const screenshotDir = path.join(dataDir, "shots");
    const result = await capturePage(
      `http://127.0.0.1:${address.port}/fixtures/benchmark/missing-alt.html`,
      { screenshotDir, settleMs: 0 },
    );
    expect(result.html).toContain("<img");
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1/);
  });
});
