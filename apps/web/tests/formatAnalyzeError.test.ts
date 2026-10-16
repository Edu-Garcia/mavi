import { describe, expect, it } from "vitest";
import { AnalyzeUrlError } from "../src/api/analyzeUrl.ts";
import { formatAnalyzeError } from "../src/api/formatAnalyzeError.ts";

describe("formatAnalyzeError", () => {
  it("traduz invalid_url para mensagem amigável", () => {
    expect(
      formatAnalyzeError(
        new AnalyzeUrlError({
          reason: "invalid_url",
          message: "URL inválida: not-a-url",
        }),
      ),
    ).toBe(
      "A URL informada é inválida. Use um endereço http(s) completo, por exemplo https://exemplo.com.",
    );
  });

  it("traduz timeout para mensagem amigável", () => {
    expect(
      formatAnalyzeError(
        new AnalyzeUrlError({
          reason: "timeout",
          message: "Timeout 60000ms exceeded.",
        }),
      ),
    ).toBe(
      "A página demorou demais para carregar. Tente de novo ou use uma URL mais rápida.",
    );
  });

  it("traduz http_error e navigation_failed para mensagem amigável", () => {
    const expected =
      "Não foi possível abrir a página. Verifique se o endereço está correto e acessível.";
    expect(
      formatAnalyzeError(
        new AnalyzeUrlError({
          reason: "http_error",
          message: "Falha HTTP 404",
        }),
      ),
    ).toBe(expected);
    expect(
      formatAnalyzeError(
        new AnalyzeUrlError({
          reason: "navigation_failed",
          message: "net::ERR_NAME_NOT_RESOLVED",
        }),
      ),
    ).toBe(expected);
  });

  it("traduz api_failure e erros de rede para mensagem amigável", () => {
    expect(
      formatAnalyzeError(
        new AnalyzeUrlError({
          reason: "api_failure",
          message: "fetch failed",
        }),
      ),
    ).toBe(
      "Não foi possível conectar à API do MAVI. Confirme que o servidor está em execução.",
    );
    expect(formatAnalyzeError(new TypeError("Failed to fetch"))).toBe(
      "Não foi possível conectar à API do MAVI. Confirme que o servidor está em execução.",
    );
  });

  it("usa fallback genérico para erros desconhecidos", () => {
    expect(formatAnalyzeError(new Error("boom"))).toBe(
      "Algo deu errado ao analisar a URL. Tente novamente.",
    );
    expect(formatAnalyzeError("weird")).toBe(
      "Algo deu errado ao analisar a URL. Tente novamente.",
    );
  });
});
