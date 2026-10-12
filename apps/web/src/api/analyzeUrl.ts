import type { AnalysisRun, Page, Violation } from "@mavi/shared";

export interface AnalyzeUrlSuccess {
  page: Page;
  analysisRun: AnalysisRun;
  violations: Violation[];
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

export interface AnalyzeUrlOptions {
  apiBaseUrl?: string;
  fetch?: typeof fetch;
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

  const response = await fetchFn(`${apiBaseUrl}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const body = (await response.json()) as
    | { page: Page; analysisRun: AnalysisRun; violations?: Violation[] }
    | {
        error: {
          reason: string;
          message: string;
          statusCode?: number;
        };
      };

  if (!response.ok || !("page" in body)) {
    const error =
      "error" in body
        ? body.error
        : { reason: "unknown", message: "Falha ao analisar URL" };
    throw new AnalyzeUrlError(error);
  }

  return {
    page: body.page,
    analysisRun: body.analysisRun,
    violations: body.violations ?? [],
    screenshotUrl: `${apiBaseUrl}/pages/${body.page.id}/screenshot`,
  };
}
