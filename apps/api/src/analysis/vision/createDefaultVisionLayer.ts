import type { AnalysisLayer } from "@mavi/shared";
import { createGeminiClient } from "../../clients/gemini.ts";
import { createVisionAnalysisLayer } from "./visionAnalysisLayer.ts";

export function createDefaultVisionLayer(options?: {
  /** Sem chave: a UI segue só com axe; o benchmark precisa falhar explícito. */
  missingKey?: "empty" | "throw";
  env?: NodeJS.ProcessEnv;
}): AnalysisLayer {
  const env = options?.env ?? process.env;
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    if (options?.missingKey === "throw") {
      return {
        analyze: async () => {
          throw new Error(
            "GEMINI_API_KEY não configurada. A avaliação batch precisa da camada visual.",
          );
        },
      };
    }
    return { analyze: async () => [] };
  }

  return createVisionAnalysisLayer({
    geminiClient: createGeminiClient({ apiKey }),
  });
}
