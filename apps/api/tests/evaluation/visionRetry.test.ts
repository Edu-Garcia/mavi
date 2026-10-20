import { describe, expect, it } from "vitest";
import {
  isRetryableVisionError,
  retryVisionCall,
} from "../../src/evaluation/precisionCoverage/visionRetry.ts";

describe("retry de visão", () => {
  it("trata timeout e 503 como retry, e 429 como cota esgotada", () => {
    expect(
      isRetryableVisionError(new Error("Gemini API timeout após 60000ms")),
    ).toBe(true);
    expect(
      isRetryableVisionError(new Error("Gemini 503 — alta demanda, tente de novo")),
    ).toBe(true);
    expect(
      isRetryableVisionError(new Error("Gemini 429 — limite de requisições")),
    ).toBe(false);
  });

  it("aguarda e chama de novo depois de um timeout, e devolve o acerto", async () => {
    const waits: number[] = [];
    let calls = 0;
    const result = await retryVisionCall(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("Gemini API timeout após 60000ms");
        }
        return "ok";
      },
      {
        attempts: 4,
        delayMs: 8_000,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
    );

    expect(result).toBe("ok");
    expect(calls).toBe(3);
    expect(waits).toEqual([8_000, 8_000]);
  });

  it("não insiste em erro que não é timeout nem 503", async () => {
    let calls = 0;
    await expect(
      retryVisionCall(
        async () => {
          calls += 1;
          throw new Error("GEMINI_API_KEY não configurada");
        },
        {
          attempts: 4,
          sleep: async () => {
            throw new Error("não deveria esperar");
          },
        },
      ),
    ).rejects.toThrow(/GEMINI_API_KEY/);
    expect(calls).toBe(1);
  });
});
