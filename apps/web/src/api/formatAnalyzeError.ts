import { AnalyzeUrlError } from "./analyzeUrl.ts";

const MESSAGES = {
  invalid_url:
    "A URL informada é inválida. Use um endereço http(s) completo, por exemplo https://exemplo.com.",
  timeout:
    "A página demorou demais para carregar. Tente de novo ou use uma URL mais rápida.",
  page_unreachable:
    "Não foi possível abrir a página. Verifique se o endereço está correto e acessível.",
  api_failure:
    "Não foi possível conectar à API do MAVI. Confirme que o servidor está em execução.",
  unknown: "Algo deu errado ao analisar a URL. Tente novamente.",
} as const;

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed")
  );
}

export function formatAnalyzeError(error: unknown): string {
  if (error instanceof AnalyzeUrlError) {
    switch (error.reason) {
      case "invalid_url":
        return MESSAGES.invalid_url;
      case "timeout":
        return MESSAGES.timeout;
      case "http_error":
      case "navigation_failed":
        return MESSAGES.page_unreachable;
      case "api_failure":
        return MESSAGES.api_failure;
      default:
        return MESSAGES.unknown;
    }
  }

  if (isNetworkError(error)) {
    return MESSAGES.api_failure;
  }

  return MESSAGES.unknown;
}
