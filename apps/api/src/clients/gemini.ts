/**
 * Cliente HTTP para Gemini (REST generateContent).
 * Usa `GEMINI_API_KEY` — ver `.env.example`. Não logar a chave.
 */

export const GEMINI_MODEL_ID = "gemini-3.8-flash";

export const DEFAULT_GEMINI_TIMEOUT_MS = 30_000;

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
  timeoutMs?: number;
}): GeminiClient {
  const model = options.model ?? GEMINI_MODEL_ID;
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl =
    options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const timeoutMs = options.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;

  return {
    async analyzeScreenshot(input) {
      if (!options.apiKey) {
        throw new Error("GEMINI_API_KEY não configurada");
      }

      const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchFn(url, {
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
          signal: controller.signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new Error(`Gemini API timeout após ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(summarizeGeminiHttpError(response.status, body));
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

export function summarizeGeminiHttpError(
  status: number,
  body: string,
): string {
  if (status === 503 || /high demand|UNAVAILABLE/i.test(body)) {
    return "Gemini 503 — alta demanda, tente de novo";
  }
  if (status === 429) {
    return "Gemini 429 — limite de requisições";
  }
  if (status === 401 || status === 403) {
    return "Gemini — chave inválida ou sem permissão";
  }
  return `Gemini ${status} — falha na API`;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "AbortError")
  );
}
