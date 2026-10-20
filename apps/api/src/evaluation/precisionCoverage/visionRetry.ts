export const VISION_RETRY_ATTEMPTS = 4;
export const VISION_RETRY_DELAY_MS = 8_000;

function visionErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isQuotaVisionError(error: unknown): boolean {
  return /429|limite de requisições|quota/i.test(visionErrorText(error));
}

/** 503 e timeout esperam e tentam de novo. 429 segue sem retry. */
export function isRetryableVisionError(error: unknown): boolean {
  const message = visionErrorText(error);
  return /503|alta demanda|timeout/i.test(message) && !isQuotaVisionError(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryVisionCall<T>(
  run: () => Promise<T>,
  options?: {
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (error: unknown, attempt: number, attempts: number) => void;
  },
): Promise<T> {
  const attempts = options?.attempts ?? VISION_RETRY_ATTEMPTS;
  const delayMs = options?.delayMs ?? VISION_RETRY_DELAY_MS;
  const sleep = options?.sleep ?? delay;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryableVisionError(error)) {
        throw error;
      }
      options?.onRetry?.(error, attempt, attempts);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
