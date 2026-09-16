import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.ts";
import {
  createAnalysisStore,
  type AnalysisStore,
} from "../src/db/analysisStore.ts";

const fixtureHtml = fileURLToPath(
  new URL("./fixtures/sample.html", import.meta.url),
);

describe("POST /analyze", () => {
  let dataDir: string;
  let app: FastifyInstance;
  let store: AnalysisStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-api-"));
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const screenshotDir = path.join(dataDir, "screenshots");
    store = await createAnalysisStore(dbPath);
    app = await buildApp({ store, screenshotDir });
  });

  afterEach(async () => {
    await app?.close();
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("captura página HTML local, persiste Page e AnalysisRun e devolve ambos", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: fixtureHtml },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      page: {
        id: string;
        url: string;
        capturedHtml: string;
        screenshotPath: string;
      };
      analysisRun: {
        id: string;
        pageId: string;
        status: string;
      };
    };

    expect(body.page.capturedHtml).toContain("Olá MAVI");
    expect(body.page.screenshotPath).toContain("screenshots");
    expect(body.analysisRun.status).toBe("completed");
    expect(body.analysisRun.pageId).toBe(body.page.id);

    const loaded = store.getAnalysisRun(body.analysisRun.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.page.capturedHtml).toContain("Olá MAVI");
    expect(loaded?.analysisRun.status).toBe("completed");
  });

  it("retorna falha explícita sem crash quando a URL é inválida", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: "http://" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        reason: "invalid_url",
      },
    });
  });

  it("retorna falha explícita sem crash para HTTP 5xx na página alvo", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("unavailable");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("endereço do servidor de teste inválido");
    }

    try {
      const response = await app.inject({
        method: "POST",
        url: "/analyze",
        payload: { url: `http://127.0.0.1:${address.port}/down` },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        error: {
          reason: "http_error",
          statusCode: 503,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
