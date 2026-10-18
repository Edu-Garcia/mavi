import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.ts";
import {
  createAnalysisStore,
  type AnalysisStore,
} from "../src/db/analysisStore.ts";

const fixtureHtml = fileURLToPath(
  new URL("./fixtures/sample.html", import.meta.url),
);
const missingAltHtml = fileURLToPath(
  new URL("./fixtures/missing-alt.html", import.meta.url),
);

describe("POST /analyze", () => {
  let dataDir: string;
  let app: FastifyInstance;
  let store: AnalysisStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-api-"));
    const dbPath = path.join(dataDir, "mavi.sqlite");
    const screenshotDir = path.join(dataDir, "screenshots");
    const axeHtmlDir = path.join(dataDir, "axe-html");
    store = await createAnalysisStore(dbPath);
    app = await buildApp({ store, screenshotDir, axeHtmlDir });
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

    const axeHtml = await app.inject({
      method: "GET",
      url: `/pages/${body.page.id}/axe-html`,
    });
    expect(axeHtml.statusCode).toBe(200);
    expect(axeHtml.headers["content-type"]).toMatch(/text\/html/);
    expect(axeHtml.body).toContain("Olá MAVI");
  });

  it("após captura, devolve violações axe (img sem alt → 1.1.1)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      page: { id: string };
      analysisRun: {
        id: string;
        modelVersions: {
          axeCore?: string;
          visionPrompt?: string;
          fixPrompt?: string;
        };
      };
      violations: Array<{
        analysisRunId: string;
        wcagCriterion: string;
        sourceLayer: string;
        htmlSnippet: string;
        description: string;
        severity: string;
      }>;
      fixSuggestions: unknown[];
    };

    expect(body.violations.length).toBeGreaterThan(0);
    const altViolation = body.violations.find((v) =>
      v.wcagCriterion.startsWith("1.1.1"),
    );
    expect(altViolation).toBeDefined();
    expect(altViolation?.sourceLayer).toBe("axe");
    expect(altViolation?.analysisRunId).toBe(body.analysisRun.id);
    expect(altViolation?.htmlSnippet.toLowerCase()).toContain("<img");
    expect(body.analysisRun.modelVersions.axeCore).toBeTruthy();
    expect(body.analysisRun.modelVersions.visionPrompt).toMatch(
      /^prompts\/vision-analysis\.md#[a-f0-9]{12}$/,
    );
    expect(body.analysisRun.modelVersions.fixPrompt).toMatch(
      /^prompts\/fix-generation\.md#[a-f0-9]{12}$/,
    );
    expect(body.fixSuggestions).toEqual([]);

    const persisted = store.listViolationsByAnalysisRun(body.analysisRun.id);
    expect(persisted.some((v) => v.wcagCriterion.startsWith("1.1.1"))).toBe(
      true,
    );
  });

  it("mantém violações axe quando a camada vision falha e registra diagnostics", async () => {
    await app.close();
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      visionLayer: {
        analyze: async () => {
          throw new Error("Gemini indisponível");
        },
      },
      generateFixes: async () => {
        throw new Error("Groq indisponível");
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      violations: Array<{ sourceLayer: string; wcagCriterion: string }>;
      fixSuggestions: unknown[];
      diagnostics: {
        vision: { attempted: boolean; error?: string; violationCount: number };
        groq: { attempted: boolean; error?: string };
        stages: Array<{ name: string; status: string }>;
      };
    };
    expect(body.violations.some((v) => v.wcagCriterion.startsWith("1.1.1"))).toBe(
      true,
    );
    expect(body.fixSuggestions).toEqual([]);
    expect(body.diagnostics.vision.attempted).toBe(true);
    expect(body.diagnostics.vision.error).toMatch(/Gemini indisponível/);
    expect(body.diagnostics.vision.violationCount).toBe(0);
    expect(body.diagnostics.groq.attempted).toBe(true);
    expect(body.diagnostics.groq.error).toMatch(/Groq indisponível/);
    expect(body.diagnostics.stages.map((stage) => stage.name)).toEqual(
      expect.arrayContaining([
        "start",
        "capture",
        "axe",
        "vision",
        "merge",
        "groq",
        "done",
      ]),
    );
  });

  it("sem GEMINI_API_KEY registra skip e não chama a API do Gemini", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await app.close();
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      env: { GEMINI_API_KEY: "", GROQ_API_KEY: "" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      diagnostics: {
        vision: { attempted: boolean; skippedReason?: string };
        groq: { attempted: boolean; skippedReason?: string };
        keys: { gemini: boolean; groq: boolean };
      };
    };
    expect(body.diagnostics.vision.attempted).toBe(false);
    expect(body.diagnostics.vision.skippedReason).toBe("missing_key");
    expect(body.diagnostics.groq.skippedReason).toBe("missing_key");
    expect(body.diagnostics.keys).toEqual({ gemini: false, groq: false });
    const geminiCalls = fetchSpy.mock.calls.filter(([requestUrl]) =>
      String(requestUrl).includes("generativelanguage.googleapis.com"),
    );
    expect(geminiCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("combina violações vision e gera fixSuggestions quando injetados", async () => {
    await app.close();
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      visionLayer: {
        analyze: async (_page, analysisRun) => [
          {
            id: "vision-1",
            analysisRunId: analysisRun.id,
            wcagCriterion: "1.4.3 Contrast (Minimum)",
            sourceLayer: "vision",
            description: "Contraste insuficiente",
            htmlSnippet: ".low-contrast",
            severity: "serious",
          },
        ],
      },
      generateFixes: async (violations) =>
        violations.map((v) => ({
          id: `fix-${v.id}`,
          violationId: v.id,
          diffBefore: v.htmlSnippet,
          diffAfter: `${v.htmlSnippet} <!-- fixed -->`,
          explanation: "Correção sugerida",
          generatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      violations: Array<{ id: string; sourceLayer: string }>;
      fixSuggestions: Array<{ violationId: string; explanation: string }>;
    };

    expect(body.violations.some((v) => v.sourceLayer === "axe")).toBe(true);
    expect(body.violations.some((v) => v.sourceLayer === "vision")).toBe(true);
    expect(body.fixSuggestions.length).toBe(body.violations.length);
    expect(body.fixSuggestions[0]?.explanation).toBe("Correção sugerida");
  });

  it("deduplica violações equivalentes axe+vision como sourceLayer both", async () => {
    await app.close();
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      visionLayer: {
        analyze: async (_page, analysisRun) => [
          {
            id: "vision-alt",
            analysisRunId: analysisRun.id,
            wcagCriterion: "1.1.1 Non-text Content",
            sourceLayer: "vision",
            description: "Imagem sem texto alternativo na região do produto",
            htmlSnippet: "img produto.jpg",
            severity: "critical",
          },
        ],
      },
      generateFixes: async () => [],
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      violations: Array<{
        wcagCriterion: string;
        sourceLayer: string;
        htmlSnippet: string;
      }>;
    };

    const altViolations = body.violations.filter((v) =>
      v.wcagCriterion.startsWith("1.1.1"),
    );
    expect(altViolations).toHaveLength(1);
    expect(altViolations[0]?.sourceLayer).toBe("both");
    expect(altViolations[0]?.htmlSnippet.toLowerCase()).toContain("<img");
  });

  it("modo audit devolve violações sem chamar geração de FixSuggestion", async () => {
    const generateFixes = vi.fn(async () => [
      {
        id: "should-not-run",
        violationId: "x",
        diffBefore: "<img>",
        diffAfter: '<img alt="x">',
        explanation: "não deve aparecer",
        generatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    await app.close();
    app = await buildApp({
      store,
      screenshotDir: path.join(dataDir, "screenshots"),
      visionLayer: {
        analyze: async () => [],
      },
      generateFixes,
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { url: missingAltHtml, mode: "audit" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      violations: Array<{ wcagCriterion: string }>;
      fixSuggestions: unknown[];
      diagnostics: {
        groq: { attempted: boolean; skippedReason?: string; suggestionCount: number };
      };
    };
    expect(body.violations.some((v) => v.wcagCriterion.startsWith("1.1.1"))).toBe(
      true,
    );
    expect(body.fixSuggestions).toEqual([]);
    expect(generateFixes).not.toHaveBeenCalled();
    expect(body.diagnostics.groq.attempted).toBe(false);
    expect(body.diagnostics.groq.skippedReason).toBe("audit_mode");
    expect(body.diagnostics.groq.suggestionCount).toBe(0);
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
