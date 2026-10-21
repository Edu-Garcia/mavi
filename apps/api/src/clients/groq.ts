/** Modelo de chat padrão no catálogo gratuito atual da Groq. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export function groqChatModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

/** @deprecated Use `groqChatModel()` — o Llama 3.3 70B saiu do catálogo gratuito. */
export const LLAMA_3_3_70B_MODEL = DEFAULT_GROQ_MODEL;

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatCompletionRequest {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
}

export interface GroqChatCompletionResult {
  content: string;
}

export interface GroqClient {
  chatCompletion(
    request: GroqChatCompletionRequest,
  ): Promise<GroqChatCompletionResult>;
}

export interface CreateGroqClientOptions {
  apiKey?: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

interface GroqApiResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export function createGroqClient(
  options: CreateGroqClientOptions = {},
): GroqClient {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl ?? "https://api.groq.com/openai/v1").replace(
    /\/$/,
    "",
  );

  return {
    async chatCompletion(request) {
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is required");
      }

      const response = await fetchFn(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Groq chat completion failed (${response.status}) model=${request.model}: ${detail}`,
        );
      }

      const body = (await response.json()) as GroqApiResponse;
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("Groq response missing message content");
      }

      return { content };
    },
  };
}
