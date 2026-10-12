import { describe, expect, it, vi } from "vitest";
import { analyzeUrl } from "../src/api/analyzeUrl.ts";
import type { AnalysisRun, Page } from "@mavi/shared";

describe("analyzeUrl", () => {
  it("POST /analyze e devolve page, analysisRun e screenshotUrl", async () => {
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
      json: async () => ({ page, analysisRun }),
    });

    const result = await analyzeUrl("https://example.com", {
      apiBaseUrl: "http://api.test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(result.page.id).toBe("page-1");
    expect(result.analysisRun.id).toBe("run-1");
    expect(result.screenshotUrl).toBe(
      "http://api.test/pages/page-1/screenshot",
    );
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
});
