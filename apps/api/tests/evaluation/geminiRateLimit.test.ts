import { describe, expect, it } from "vitest";
import {
  createGeminiRateLimiter,
  withGeminiRateLimit,
} from "../../src/evaluation/precisionCoverage/geminiRateLimit.ts";

describe("createGeminiRateLimiter", () => {
  it("espaça 16ª chamada para caber em 15 RPM e para no teto diário", async () => {
    let now = 1_000;
    const sleeps: number[] = [];
    const limiter = createGeminiRateLimiter({
      rpm: 15,
      rpd: 16,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });

    for (let index = 0; index < 15; index += 1) {
      await limiter.acquire();
    }
    expect(limiter.dailyCount).toBe(15);

    await limiter.acquire();
    expect(sleeps.some((ms) => ms >= 4_000)).toBe(true);
    expect(limiter.dailyCount).toBe(16);

    await expect(limiter.acquire()).rejects.toThrow(
      "Gemini 429 — limite de requisições",
    );
  });
});

describe("withGeminiRateLimit", () => {
  it("adquire cota antes de cada generateContent", async () => {
    const acquired: number[] = [];
    const limiter = {
      rpm: 15,
      rpd: 500,
      dailyCount: 0,
      async acquire() {
        acquired.push(Date.now());
      },
    };
    const client = withGeminiRateLimit(
      {
        analyzeScreenshot: async () => '{"violations":[]}',
      },
      limiter,
    );

    await expect(
      client.analyzeScreenshot({
        prompt: "x",
        imageBytes: Buffer.from("png"),
        mimeType: "image/png",
      }),
    ).resolves.toBe('{"violations":[]}');
    expect(acquired).toHaveLength(1);
  });
});
