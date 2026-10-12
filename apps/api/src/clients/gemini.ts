/**
 * Cliente HTTP para Gemini (REST generateContent).
 * Usa `GEMINI_API_KEY` — ver `.env.example`. Não logar a chave.
 */

export const GEMINI_MODEL_ID = "gemini-2.5-flash";

export interface GeminiAnalyzeScreenshotInput {
  prompt: string;
  imageBytes: Buffer;
  mimeType: string;
}

export interface GeminiClient {
  analyzeScreenshot(input: GeminiAnalyzeScreenshotInput): Promise<string>;
}

export function geminiModelVersion(): string {
  return GEMINI_MODEL_ID;
}

export function createGeminiClient(options: {
  /** Preferir `process.env.GEMINI_API_KEY` no wiring da aplicação. */
  apiKey: string;
  model?: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}): GeminiClient {
  const model = options.model ?? GEMINI_MODEL_ID;
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl =
    options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";

  return {
    async analyzeScreenshot(input) {
      if (!options.apiKey) {
        throw new Error("GEMINI_API_KEY não configurada");
      }

      const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: input.prompt },
                {
                  inline_data: {
                    mime_type: input.mimeType,
                    data: input.imageBytes.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Gemini API falhou (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new Error("Gemini API retornou resposta sem texto");
      }

      return text;
    },
  };
}
