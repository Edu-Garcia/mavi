import { describe, expect, it, vi } from "vitest";
import { createGeminiClient } from "../../src/clients/gemini.ts";

describe("createGeminiClient", () => {
  it("envia prompt e imagem inline_data para generateContent", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '{"violations":[]}' }] } },
        ],
      }),
    });
    const client = createGeminiClient({
      apiKey: "test-key",
      fetchFn: fetchFn as unknown as typeof fetch,
      timeoutMs: 1000,
    });

    const text = await client.analyzeScreenshot({
      prompt: "analise a imagem",
      imageBytes: Buffer.from("png-bytes"),
      mimeType: "image/png",
    });

    expect(text).toBe('{"violations":[]}');
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.8-flash:generateContent");
    expect(url).not.toContain("test-key-should-not-be-logged");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toBe("analise a imagem");
    expect(body.contents[0].parts[1].inline_data).toEqual({
      mime_type: "image/png",
      data: Buffer.from("png-bytes").toString("base64"),
    });
  });

  it("resume 503 sem incluir o JSON da API", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () =>
        '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
    });

    const client = createGeminiClient({
      apiKey: "test-key",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(
      client.analyzeScreenshot({
        prompt: "analise",
        imageBytes: Buffer.from("x"),
        mimeType: "image/png",
      }),
    ).rejects.toThrow("Gemini 503 — alta demanda, tente de novo");
  });

  it("falha com timeout quando o fetch aborta", async () => {
    const fetchFn = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const client = createGeminiClient({
      apiKey: "test-key",
      fetchFn: fetchFn as unknown as typeof fetch,
      timeoutMs: 20,
    });

    await expect(
      client.analyzeScreenshot({
        prompt: "analise",
        imageBytes: Buffer.from("x"),
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/timeout após 20ms/);
  });
});
