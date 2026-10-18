import { describe, expect, it, vi } from "vitest";
import { analyzeUrl } from "../src/api/analyzeUrl.ts";
import type { AnalysisRun, Page } from "@mavi/shared";

describe("analyzeUrl", () => {
  it("POST /analyze e devolve page, analysisRun, violations, fixSuggestions e screenshotUrl", async () => {
    const page: Page = {
      id: "page-1",
      url: "https://example.com",
      capturedHtml: "<html></html>",
      screenshotPath: "/data/screenshots/shot.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const analysisRun: AnalysisRun = {
      id: "run-1",
      pageId: "page-1",
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-01-01T00:00:01.000Z"),
      modelVersions: {},
    };
    const violations = [
      {
        id: "v1",
        analysisRunId: "run-1",
        wcagCriterion: "1.1.1 Non-text Content",
        sourceLayer: "axe" as const,
        description: "Imagem sem alt",
        htmlSnippet: "<img>",
        severity: "critical" as const,
      },
    ];
    const fixSuggestions = [
      {
        id: "fix-1",
        violationId: "v1",
        diffBefore: "<img>",
        diffAfter: '<img alt="x">',
        explanation: "alt",
        generatedAt: new Date("2026-01-01T00:00:02.000Z"),
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ page, analysisRun, violations, fixSuggestions }),
    });

    const result = await analyzeUrl("https://example.com", {
      apiBaseUrl: "http://api.test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", mode: "fix" }),
    });
    expect(result.page.id).toBe("page-1");
    expect(result.analysisRun.id).toBe("run-1");
    expect(result.violations).toEqual(violations);
    expect(result.fixSuggestions).toEqual(fixSuggestions);
    expect(result.screenshotUrl).toBe(
      "http://api.test/pages/page-1/screenshot",
    );
    expect(result.axeHtmlUrl).toBe("http://api.test/pages/page-1/axe-html");
    expect(result.diagnostics.vision.attempted).toBe(false);
  });

  it("propaga falha explícita da API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { reason: "invalid_url", message: "Campo url é obrigatório" },
      }),
    });

    await expect(
      analyzeUrl("", {
        apiBaseUrl: "http://api.test",
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      reason: "invalid_url",
      message: "Campo url é obrigatório",
    });
  });

  it("envia mode audit no body do POST /analyze", async () => {
    const page: Page = {
      id: "page-1",
      url: "https://example.com",
      capturedHtml: "<html></html>",
      screenshotPath: "/data/screenshots/shot.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const analysisRun: AnalysisRun = {
      id: "run-1",
      pageId: "page-1",
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-01-01T00:00:01.000Z"),
      modelVersions: {},
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        page,
        analysisRun,
        violations: [],
        fixSuggestions: [],
      }),
    });

    await analyzeUrl("https://example.com", {
      apiBaseUrl: "http://api.test",
      fetch: fetchMock as unknown as typeof fetch,
      mode: "audit",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", mode: "audit" }),
    });
  });

  it("envolve falha de rede em AnalyzeUrlError com reason api_failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      analyzeUrl("https://example.com", {
        apiBaseUrl: "http://api.test",
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      reason: "api_failure",
      message: "Failed to fetch",
    });
  });
});

