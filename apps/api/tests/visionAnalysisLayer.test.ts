import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisRun, Page } from "@mavi/shared";
import type { GeminiClient } from "../src/clients/gemini.ts";
import { createVisionAnalysisLayer } from "../src/analysis/vision/visionAnalysisLayer.ts";
import { VISION_PROMPT_RELATIVE_PATH } from "../src/analysis/vision/loadVisionPrompt.ts";

/** Minimal valid 1×1 PNG used as insufficient-contrast screenshot fixture */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const fixtureScreenshotPath = fileURLToPath(
  new URL("./fixtures/insufficient-contrast.png", import.meta.url),
);

function stubRun(pageId: string): AnalysisRun {
  return {
    id: "run-vision-1",
    pageId,
    status: "running",
    startedAt: new Date("2026-01-15T12:00:00.000Z"),
    completedAt: null,
    modelVersions: {},
  };
}

describe("VisionAnalysisLayer", () => {
  it("gera Violation com sourceLayer vision a partir do screenshot (Gemini mockado)", async () => {
    await mkdir(path.dirname(fixtureScreenshotPath), { recursive: true });
    await writeFile(fixtureScreenshotPath, PNG_BYTES);

    const geminiClient: GeminiClient = {
      analyzeScreenshot: vi.fn(async () =>
        JSON.stringify({
          violations: [
            {
              wcagCriterion: "1.4.3 Contrast",
              description:
                "Texto cinza claro sobre fundo branco com contraste insuficiente",
              location: "parágrafo principal .low-contrast-text",
              severity: "serious",
            },
          ],
        }),
      ),
    };

    const layer = createVisionAnalysisLayer({ geminiClient });
    const page: Page = {
      id: "page-contrast",
      url: "file:///insufficient-contrast.html",
      capturedHtml: "<p class='low-contrast-text'>texto fraco</p>",
      screenshotPath: fixtureScreenshotPath,
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
    };

    const violations = await layer.analyze(page, stubRun(page.id));

    expect(geminiClient.analyzeScreenshot).toHaveBeenCalledOnce();
    const call = vi.mocked(geminiClient.analyzeScreenshot).mock.calls[0]?.[0];
    expect(call?.imageBytes.equals(PNG_BYTES)).toBe(true);
    expect(call?.mimeType).toBe("image/png");
    expect(call?.prompt.length).toBeGreaterThan(0);
    expect(call?.prompt).toMatch(/WCAG|contraste|violação/i);

    const contrast = violations.find((v) =>
      v.wcagCriterion.startsWith("1.4.3"),
    );
    expect(contrast).toBeDefined();
    expect(contrast?.sourceLayer).toBe("vision");
    expect(contrast?.analysisRunId).toBe("run-vision-1");
    expect(contrast?.description.length).toBeGreaterThan(0);
    expect(contrast?.htmlSnippet).toContain(".low-contrast-text");
    expect(contrast?.severity).toBe("serious");
  });

  it("carrega o prompt de arquivo versionado, não de string hardcoded na layer", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "mavi-vision-prompt-"));
    const screenshotPath = path.join(dataDir, "shot.png");
    await writeFile(screenshotPath, PNG_BYTES);

    const geminiClient: GeminiClient = {
      analyzeScreenshot: vi.fn(async ({ prompt }) => {
        expect(prompt).toContain("PROMPT_MARKER_VISION_V1");
        return JSON.stringify({ violations: [] });
      }),
    };

    const customPromptPath = path.join(dataDir, "vision-analysis.md");
    await writeFile(
      customPromptPath,
      "# Vision\n\nPROMPT_MARKER_VISION_V1\nAnalise o screenshot.",
      "utf8",
    );

    const layer = createVisionAnalysisLayer({
      geminiClient,
      promptPath: customPromptPath,
    });

    await layer.analyze(
      {
        id: "page-1",
        url: "https://example.com",
        capturedHtml: "<html></html>",
        screenshotPath,
        createdAt: new Date(),
      },
      stubRun("page-1"),
    );

    expect(VISION_PROMPT_RELATIVE_PATH).toBe("prompts/vision-analysis.md");
    expect(geminiClient.analyzeScreenshot).toHaveBeenCalledOnce();
  });

  it("retorna lista vazia quando o Gemini devolve JSON malformado", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "mavi-vision-bad-"));
    const screenshotPath = path.join(dataDir, "shot.png");
    await writeFile(screenshotPath, PNG_BYTES);

    const layer = createVisionAnalysisLayer({
      geminiClient: {
        analyzeScreenshot: async () => "isto não é json {{{",
      },
    });

    const violations = await layer.analyze(
      {
        id: "page-bad",
        url: "https://example.com",
        capturedHtml: "<html></html>",
        screenshotPath,
        createdAt: new Date(),
      },
      stubRun("page-bad"),
    );

    expect(violations).toEqual([]);
  });
});
