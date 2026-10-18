import type {
  AnalysisRun,
  AnalyzeDiagnostics,
  FixSuggestion,
  Page,
  Violation,
} from "@mavi/shared";
import { emptyAnalyzeDiagnostics } from "@mavi/shared";
import { resolveApiBaseUrl } from "./apiBaseUrl.ts";

export interface AnalyzeUrlSuccess {
  page: Page;
  analysisRun: AnalysisRun;
  violations: Violation[];
  fixSuggestions: FixSuggestion[];
  screenshotUrl: string;
  axeHtmlUrl: string;
  diagnostics: AnalyzeDiagnostics;
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
        diagnostics?: AnalyzeDiagnostics;
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
    axeHtmlUrl: `${apiBaseUrl}/pages/${body.page.id}/axe-html`,
    diagnostics: body.diagnostics ?? emptyAnalyzeDiagnostics(),
  };
}
