import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, errors as playwrightErrors } from "playwright";

export type CaptureFailureReason =
  | "timeout"
  | "invalid_url"
  | "http_error"
  | "navigation_failed";

export class CaptureError extends Error {
  readonly reason: CaptureFailureReason;
  readonly statusCode?: number;

  constructor(
    reason: CaptureFailureReason,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = "CaptureError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export interface CaptureResult {
  url: string;
  html: string;
  screenshotPath: string;
}

export interface CapturePageOptions {
  screenshotDir: string;
  timeoutMs?: number;
}

function resolveNavigationUrl(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new CaptureError("invalid_url", "URL vazia");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new CaptureError("invalid_url", `URL inválida: ${source}`);
    }

    if (!parsed.hostname) {
      throw new CaptureError("invalid_url", `URL inválida: ${source}`);
    }

    return parsed.href;
  }

  if (/^file:/i.test(trimmed)) {
    return trimmed;
  }

  return pathToFileURL(path.resolve(trimmed)).href;
}

function mapNavigationError(error: unknown): CaptureError {
  if (error instanceof CaptureError) {
    return error;
  }

  if (error instanceof playwrightErrors.TimeoutError) {
    return new CaptureError(
      "timeout",
      error.message || "Tempo esgotado ao navegar",
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return new CaptureError("navigation_failed", message);
}

export async function capturePage(
  source: string,
  options: CapturePageOptions,
): Promise<CaptureResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const navigationUrl = resolveNavigationUrl(source);

  await mkdir(options.screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let response;
    try {
      response = await page.goto(navigationUrl, {
        waitUntil: "networkidle",
        timeout: timeoutMs,
      });
    } catch (error) {
      throw mapNavigationError(error);
    }

    if (response) {
      const statusCode = response.status();
      if (statusCode >= 400) {
        throw new CaptureError(
          "http_error",
          `Falha HTTP ${statusCode} ao capturar ${navigationUrl}`,
          statusCode,
        );
      }
    }

    const html = await page.content();
    const screenshotPath = path.join(
      options.screenshotDir,
      `screenshot-${Date.now()}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return {
      url: page.url(),
      html,
      screenshotPath,
    };
  } finally {
    await browser.close();
  }
}
