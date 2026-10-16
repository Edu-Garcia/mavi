import type {
  AnalysisRun,
  FixSuggestion,
  Page,
  Violation,
} from "@mavi/shared";

export interface AnalyzeUrlSuccess {
  page: Page;
  analysisRun: AnalysisRun;
  violations: Violation[];
  fixSuggestions: FixSuggestion[];
  screenshotUrl: string;
}

export class AnalyzeUrlError extends Error {
  readonly reason: string;
  readonly statusCode?: number;

  constructor(options: {
    reason: string;
    message: string;
    statusCode?: number;
  }) {
    super(options.message);
    this.name = "AnalyzeUrlError";
    this.reason = options.reason;
    this.statusCode = options.statusCode;
  }
}

export type AnalyzeMode = "audit" | "fix";

export interface AnalyzeUrlOptions {
  apiBaseUrl?: string;
  fetch?: typeof fetch;
  mode?: AnalyzeMode;
}

function resolveApiBaseUrl(apiBaseUrl?: string): string {
  if (apiBaseUrl !== undefined) {
    return apiBaseUrl.replace(/\/$/, "");
  }
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return (fromEnv ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function analyzeUrl(
  url: string,
  options: AnalyzeUrlOptions = {},
): Promise<AnalyzeUrlSuccess> {
  const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl);
  const fetchFn = options.fetch ?? fetch;

  const mode = options.mode === "audit" ? "audit" : "fix";

  let response: Response;
  try {
    response = await fetchFn(`${apiBaseUrl}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, mode }),
    });
  } catch (error) {
    throw new AnalyzeUrlError({
      reason: "api_failure",
      message: error instanceof Error ? error.message : "Falha ao conectar à API",
    });
  }

  let body:
    | {
        page: Page;
        analysisRun: AnalysisRun;
        violations?: Violation[];
        fixSuggestions?: FixSuggestion[];
      }
    | {
        error: {
          reason: string;
          message: string;
          statusCode?: number;
        };
      };

  try {
    body = (await response.json()) as typeof body;
  } catch (error) {
    throw new AnalyzeUrlError({
      reason: "api_failure",
      message: error instanceof Error ? error.message : "Resposta inválida da API",
    });
  }

  if (!response.ok || !("page" in body)) {
    if ("error" in body && body.error.reason) {
      throw new AnalyzeUrlError(body.error);
    }
    throw new AnalyzeUrlError({
      reason: "api_failure",
      message: "Falha ao analisar URL",
      statusCode: response.status,
    });
  }

  return {
    page: body.page,
    analysisRun: body.analysisRun,
    violations: body.violations ?? [],
    fixSuggestions: body.fixSuggestions ?? [],
    screenshotUrl: `${apiBaseUrl}/pages/${body.page.id}/screenshot`,
  };
}
