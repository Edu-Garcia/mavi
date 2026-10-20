import type { GeminiClient } from "../../clients/gemini.ts";

/** Cota gratuita típica do Gemini 3.5 Flash-Lite. */
export const GEMINI_FLASH_LITE_RPM = 15;
export const GEMINI_FLASH_LITE_RPD = 500;

export interface GeminiRateLimiter {
  readonly rpm: number;
  readonly rpd: number;
  readonly dailyCount: number;
  acquire(): Promise<void>;
}

export interface CreateGeminiRateLimiterOptions {
  rpm?: number;
  rpd?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function createGeminiRateLimiter(
  options: CreateGeminiRateLimiterOptions = {},
): GeminiRateLimiter {
  const rpm = options.rpm ?? GEMINI_FLASH_LITE_RPM;
  const rpd = options.rpd ?? GEMINI_FLASH_LITE_RPD;
  const minIntervalMs = Math.ceil(60_000 / rpm);
  const nowFn = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let starts: number[] = [];
  let dailyCount = 0;
  let dayStamp = "";

  return {
    rpm,
    rpd,
    get dailyCount() {
      return dailyCount;
    },
    async acquire() {
      for (;;) {
        const now = nowFn();
        const day = utcDay(now);
        if (day !== dayStamp) {
          dayStamp = day;
          dailyCount = 0;
        }
        if (dailyCount >= rpd) {
          throw new Error("Gemini 429 — limite de requisições");
        }

        starts = starts.filter((stamp) => now - stamp < 60_000);
        const waitWindow =
          starts.length >= rpm ? 60_000 - (now - starts[0]!) + 1 : 0;
        const last = starts.at(-1);
        const waitGap =
          last == null ? 0 : Math.max(0, minIntervalMs - (now - last));
        const wait = Math.max(waitWindow, waitGap);
        if (wait > 0) {
          await sleep(wait);
          continue;
        }

        starts.push(now);
        dailyCount += 1;
        return;
      }
    },
  };
}

export function withGeminiRateLimit(
  client: GeminiClient,
  limiter: GeminiRateLimiter,
): GeminiClient {
  return {
    async analyzeScreenshot(input) {
      await limiter.acquire();
      return client.analyzeScreenshot(input);
    },
  };
}
