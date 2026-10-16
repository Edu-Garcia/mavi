import { useState, type FormEvent } from "react";
import {
  analyzeUrl as defaultAnalyzeUrl,
  type AnalyzeMode,
  type AnalyzeUrlSuccess,
} from "./api/analyzeUrl.ts";
import { formatAnalyzeError } from "./api/formatAnalyzeError.ts";
import { ViolationsReport } from "./components/ViolationsReport.tsx";
import { buildAuditReportHtml } from "./report/buildAuditReportHtml.ts";
import { downloadHtml, fetchAsDataUrl } from "./report/downloadHtml.ts";

export type { Page } from "@mavi/shared";

export type AnalyzeFn = (
  url: string,
  options?: { mode?: AnalyzeMode },
) => Promise<AnalyzeUrlSuccess>;

export interface AppProps {
  analyze?: AnalyzeFn;
  fetchScreenshotAsDataUrl?: (url: string) => Promise<string>;
  downloadReport?: (html: string, filename: string) => void;
}

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: AnalyzeUrlSuccess; mode: AnalyzeMode }
  | { status: "error"; message: string };

export function App({
  analyze = defaultAnalyzeUrl,
  fetchScreenshotAsDataUrl = fetchAsDataUrl,
  downloadReport = downloadHtml,
}: AppProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<AnalyzeMode>("fix");
  const [view, setView] = useState<ViewState>({ status: "idle" });
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExportError(null);
    setView({ status: "loading" });
    try {
      const result = await analyze(url.trim(), { mode });
      setView({ status: "ready", result, mode });
    } catch (error) {
      setView({ status: "error", message: formatAnalyzeError(error) });
    }
  }

  async function handleExport() {
    if (view.status !== "ready") {
      return;
    }
    setExportError(null);
    try {
      const screenshotSrc = await fetchScreenshotAsDataUrl(
        view.result.screenshotUrl,
      );
      const analyzedAt =
        view.result.analysisRun.completedAt ??
        view.result.analysisRun.startedAt ??
        new Date();
      const html = buildAuditReportHtml({
        pageUrl: view.result.page.url,
        analyzedAt,
        screenshotSrc,
        violations: view.result.violations,
      });
      const safeName = view.result.page.url
        .replace(/^https?:\/\//, "")
        .replace(/[^\w.-]+/g, "-")
        .slice(0, 60);
      downloadReport(html, `mavi-auditoria-${safeName || "pagina"}.html`);
    } catch {
      setExportError("Não foi possível exportar o relatório HTML.");
    }
  }

  return (
    <main>
      <h1>MAVI</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="url-input">URL</label>
        <input
          id="url-input"
          name="url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://exemplo.com"
          required
          disabled={view.status === "loading"}
        />

        <fieldset disabled={view.status === "loading"}>
          <legend>Modo de análise</legend>
          <label>
            <input
              type="radio"
              name="analyze-mode"
              value="fix"
              checked={mode === "fix"}
              onChange={() => setMode("fix")}
            />
            Com sugestões de código
          </label>
          <label>
            <input
              type="radio"
              name="analyze-mode"
              value="audit"
              checked={mode === "audit"}
              onChange={() => setMode("audit")}
            />
            Auditoria (sem correções de código)
          </label>
          {mode === "audit" ? (
            <p>
              Neste modo o MAVI analisa a página e lista as violações, sem gerar
              diffs de correção.
            </p>
          ) : null}
        </fieldset>

        <button type="submit" disabled={view.status === "loading"}>
          Analisar
        </button>
      </form>

      {view.status === "loading" ? <p>Analisando…</p> : null}

      {view.status === "error" ? (
        <p role="alert">{view.message}</p>
      ) : null}

      {view.status === "ready" ? (
        <section aria-label="Relatório">
          {view.mode === "audit" ? (
            <p>Relatório de auditoria — sem sugestões de código.</p>
          ) : null}
          <img
            src={view.result.screenshotUrl}
            alt={`Screenshot de ${view.result.page.url}`}
          />
          <ViolationsReport
            violations={view.result.violations}
            fixSuggestions={
              view.mode === "audit" ? [] : view.result.fixSuggestions
            }
          />
          <button type="button" onClick={handleExport}>
            Exportar relatório HTML
          </button>
          <p>
            Abra o arquivo no navegador e use Imprimir → salvar como PDF, se
            precisar.
          </p>
          {exportError ? <p role="alert">{exportError}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
