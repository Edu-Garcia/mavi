import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisLayer, AnalysisRun, Page, Violation } from "@mavi/shared";
import type { GeminiClient } from "../../clients/gemini.ts";
import { loadVisionPrompt } from "./loadVisionPrompt.ts";
import { parseVisionResponse } from "./parseVisionResponse.ts";

export interface VisionAnalysisLayerDeps {
  geminiClient: GeminiClient;
  /** Override do path do prompt (testes). Default: prompts/vision-analysis.md */
  promptPath?: string;
  onRawResponse?: (page: Page, raw: string) => Promise<void> | void;
}

function mimeTypeForScreenshot(screenshotPath: string): string {
  const ext = path.extname(screenshotPath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "image/png";
}

export function createVisionAnalysisLayer(
  deps: VisionAnalysisLayerDeps,
): AnalysisLayer {
  return {
    async analyze(page: Page, analysisRun: AnalysisRun): Promise<Violation[]> {
      const [prompt, imageBytes] = await Promise.all([
        loadVisionPrompt(deps.promptPath),
        readFile(page.screenshotPath),
      ]);

      const raw = await deps.geminiClient.analyzeScreenshot({
        prompt,
        imageBytes,
        mimeType: mimeTypeForScreenshot(page.screenshotPath),
      });
      await deps.onRawResponse?.(page, raw);

      const parsed = parseVisionResponse(raw);
      return parsed.map(
        (item): Violation => ({
          id: randomUUID(),
          analysisRunId: analysisRun.id,
          wcagCriterion: item.wcagCriterion,
          sourceLayer: "vision",
          description: item.description,
          // Sem HTML do DOM: usar localização aproximada / seletor como snippet
          htmlSnippet: item.location,
          severity: item.severity,
        }),
      );
    },
  };
}
