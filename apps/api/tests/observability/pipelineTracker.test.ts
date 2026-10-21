import { describe, expect, it } from "vitest";
import {
  createPipelineTracker,
  formatDuration,
  formatPipelineStageLine,
  summarizeLayerError,
} from "../../src/observability/pipelineTracker.ts";

describe("pipeline log", () => {
  it("formata etapas em colunas legíveis", () => {
    expect(formatPipelineStageLine("capture", "ok", 1555)).toBe(
      "  captura      ok       1.6s",
    );
    expect(
      formatPipelineStageLine("axe", "ok", 971, { violationCount: 10 }),
    ).toBe("  axe          ok      971ms   10 violações");
    expect(
      formatPipelineStageLine("groq", "skipped", 0, {
        skippedReason: "audit_mode",
      }),
    ).toBe("  groq         pulado    0ms   modo auditoria");
  });

  it("resume erro do Gemini sem JSON", () => {
    const raw = `Gemini API falhou (503): {\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand.",\n    "status": "UNAVAILABLE"\n  }\n}`;
    expect(summarizeLayerError(new Error(raw))).toBe(
      "Gemini 503 — alta demanda, tente de novo",
    );
    expect(summarizeLayerError(new Error("Gemini indisponível"))).toBe(
      "Gemini indisponível",
    );
    expect(summarizeLayerError(new Error("Gemini API falhou (429)"))).toBe(
      "Gemini 429 — limite de requisições",
    );
    expect(
      summarizeLayerError(
        new Error(
          "Groq chat completion failed (429) model=openai/gpt-oss-120b: rate limit",
        ),
      ),
    ).toBe("Groq 429 — limite de requisições (openai/gpt-oss-120b)");
  });

  it("escreve o bloco da análise com espaço entre as etapas", () => {
    const lines: string[] = [];
    const tracker = createPipelineTracker({
      runId: "run-1",
      url: "https://exemplo.com",
      mode: "audit",
      sink: { write: (line) => lines.push(line) },
    });

    tracker.record("start", "ok", 0);
    tracker.record("capture", "ok", 1200);
    tracker.record("axe", "ok", 800, { violationCount: 2 });
    tracker.record("vision", "error", 3300, {
      error: "Gemini 503 — alta demanda, tente de novo",
    });
    tracker.record("merge", "ok", 20, { violationCount: 2 });
    tracker.record("groq", "skipped", 0, { skippedReason: "audit_mode" });
    tracker.record("done", "ok", 5400);

    expect(lines.join("\n")).toBe(
      [
        "",
        "MAVI  análise  modo auditoria",
        "URL   https://exemplo.com",
        "",
        "  captura      ok       1.2s",
        "  axe          ok      800ms   2 violações",
        "  vision       erro     3.3s   Gemini 503 — alta demanda, tente de novo",
        "  cruzamento   ok       20ms   2 violações",
        "  groq         pulado    0ms   modo auditoria",
        "",
        "concluído em 5.4s",
        "",
      ].join("\n"),
    );
    expect(formatDuration(5400)).toBe("5.4s");
  });
});
