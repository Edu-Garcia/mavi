import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import {
  analyzeUrl as defaultAnalyzeUrl,
  type AnalyzeMode,
  type AnalyzeUrlSuccess,
} from "./api/analyzeUrl.ts";
import { resolveApiBaseUrl } from "./api/apiBaseUrl.ts";
import { formatAnalyzeError } from "./api/formatAnalyzeError.ts";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel.tsx";
import { MAVI_LOGO_LIGHT_SRC, MaviLogo } from "./components/MaviLogo.tsx";
import { ViolationsReport } from "./components/ViolationsReport.tsx";
import {
  datacorpPageShortcuts,
  testPageShortcuts,
  type TestPageShortcut,
} from "./fixtures/testPages.ts";
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
  apiBaseUrl?: string;
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
  apiBaseUrl,
}: AppProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<AnalyzeMode>("fix");
  const [view, setView] = useState<ViewState>({ status: "idle" });
  const [exportError, setExportError] = useState<string | null>(null);
  const apiBase = resolveApiBaseUrl(apiBaseUrl);
  const fixtures = testPageShortcuts(apiBase);
  const datacorpPages = datacorpPageShortcuts(apiBase);

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
      const logoSrc = await fetchScreenshotAsDataUrl(MAVI_LOGO_LIGHT_SRC).catch(
        () => "",
      );
      const analyzedAt =
        view.result.analysisRun.completedAt ??
        view.result.analysisRun.startedAt ??
        new Date();
      const html = buildAuditReportHtml({
        pageUrl: view.result.page.url,
        analyzedAt,
        screenshotSrc,
        logoSrc,
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
    <div className="min-h-screen max-w-full overflow-x-clip bg-bg">
      <header className="bg-primary text-on-navy">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <MaviLogo size={36} />
          <span className="font-display text-lg font-semibold tracking-tight text-on-navy">
            MAVI
          </span>
        </div>
      </header>

      <main className="mx-auto grid min-w-0 max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid min-w-0 gap-3">
          <div className="flex items-center gap-4">
            <MaviLogo size={64} variant="light" />
            <div className="grid gap-1">
              <p className="m-0 text-sm font-semibold uppercase tracking-wide text-accent-dark">
                Auditoria de acessibilidade
              </p>
              <h1 className="m-0 font-display text-4xl font-semibold tracking-tight text-primary">
                MAVI - Modelo de Análise Visual Inclusiva
              </h1>
            </div>
          </div>
          <p className="m-0 max-w-2xl text-muted">
            Analisa uma URL com axe-core e Gemini, cruza as violações WCAG e, no
            modo com correções, sugere diffs de código.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid min-w-0 gap-6 rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="grid gap-2">
            <label htmlFor="url-input" className="font-semibold">
              URL
            </label>
            <input
              id="url-input"
              name="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://exemplo.com"
              required
              disabled={view.status === "loading"}
              className="w-full rounded-lg border border-border bg-alt px-3 py-2 text-ink disabled:opacity-60"
            />
          </div>

          <ShortcutList
            legend="Páginas de teste"
            pages={fixtures}
            disabled={view.status === "loading"}
            onSelect={setUrl}
          />
          <ShortcutList
            legend="Levantamento Datacorp"
            description="Controle, uma página correta por critério, as falhas isoladas e uma mista em que formulário e links falham."
            pages={datacorpPages}
            disabled={view.status === "loading"}
            onSelect={setUrl}
          />

          <fieldset
            disabled={view.status === "loading"}
            className="m-0 grid gap-3 border-0 p-0"
          >
            <legend className="float-none w-full px-0 font-semibold">
              Modo de análise
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-alt p-3 has-[:checked]:border-accent-dark has-[:checked]:bg-peach">
                <input
                  type="radio"
                  name="analyze-mode"
                  value="fix"
                  checked={mode === "fix"}
                  onChange={() => setMode("fix")}
                  className="mt-1"
                />
                <span>Com sugestões de código</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-alt p-3 has-[:checked]:border-accent-dark has-[:checked]:bg-peach">
                <input
                  type="radio"
                  name="analyze-mode"
                  value="audit"
                  checked={mode === "audit"}
                  onChange={() => setMode("audit")}
                  className="mt-1"
                />
                <span>Auditoria (sem correções de código)</span>
              </label>
            </div>
            {mode === "audit" ? (
              <p className="m-0 text-sm text-muted">
                Neste modo o MAVI analisa a página e lista as violações, sem
                gerar diffs de correção.
              </p>
            ) : (
              <p className="m-0 text-sm text-muted">
                Neste modo cada violação pode trazer um diff antes/depois gerado
                pelo Groq.
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            className="cursor-pointer justify-self-start rounded-lg bg-primary px-4 py-2.5 font-semibold text-surface transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={view.status === "loading"}
          >
            Analisar
          </button>
        </form>

        {view.status === "loading" ? (
          <section
            aria-live="polite"
            className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <p className="mt-0 font-semibold">Analisando…</p>
            <ol aria-label="Etapas da análise" className="mb-0 grid gap-2">
              <li>Capturar página</li>
              <li>Análise estrutural (axe)</li>
              <li>Análise visual (Gemini)</li>
              <li>Cruzar violações</li>
              {mode === "fix" ? <li>Gerar correções (Groq)</li> : null}
            </ol>
          </section>
        ) : null}

        {view.status === "error" ? (
          <p
            role="alert"
            className="m-0 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3 text-critical"
          >
            {view.message}
          </p>
        ) : null}

        {view.status === "ready" ? (
          <section aria-label="Relatório" className="grid min-w-0 gap-6">
            {view.mode === "audit" ? (
              <p className="m-0 rounded-xl border border-border bg-surface px-4 py-3">
                Relatório de auditoria — sem sugestões de código.
              </p>
            ) : (
              <p className="m-0 rounded-xl border border-border bg-surface px-4 py-3">
                Relatório com sugestões de código.
              </p>
            )}
            {view.result.diagnostics.vision.skippedReason === "missing_key" ? (
              <p
                role="status"
                className="m-0 rounded-xl border border-serious/30 bg-serious/10 px-4 py-3"
              >
                Camada visual não rodou: GEMINI_API_KEY ausente no processo da
                API.
              </p>
            ) : null}
            {view.result.diagnostics.vision.error ? (
              <p
                role="status"
                className="m-0 rounded-xl border border-serious/30 bg-serious/10 px-4 py-3"
              >
                Camada visual falhou: {view.result.diagnostics.vision.error}
              </p>
            ) : null}
            {view.mode === "fix" &&
            view.result.diagnostics.groq.skippedReason === "missing_key" ? (
              <p
                role="status"
                className="m-0 rounded-xl border border-serious/30 bg-serious/10 px-4 py-3"
              >
                Sugestões de código não foram geradas: GROQ_API_KEY ausente no
                processo da API.
              </p>
            ) : null}
            {view.mode === "fix" && view.result.diagnostics.groq.error ? (
              <p
                role="status"
                className="m-0 rounded-xl border border-serious/30 bg-serious/10 px-4 py-3"
              >
                Sugestões de código falharam: {view.result.diagnostics.groq.error}
              </p>
            ) : null}
            <img
              src={view.result.screenshotUrl}
              alt={`Screenshot de ${view.result.page.url}`}
              className="h-auto max-w-full rounded-xl border border-border shadow-sm"
            />
            <p className="m-0">
              <a
                href={view.result.axeHtmlUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent-dark underline decoration-accent underline-offset-4"
              >
                Abrir HTML analisado pelo axe
              </a>
            </p>
            <ViolationsReport
              violations={view.result.violations}
              fixSuggestions={
                view.mode === "audit" ? [] : view.result.fixSuggestions
              }
            />
            <DiagnosticsPanel diagnostics={view.result.diagnostics} />
            <div className="grid gap-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 justify-self-start rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold text-primary transition-colors duration-200 hover:bg-peach"
                onClick={handleExport}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Exportar relatório HTML
              </button>
              <p className="m-0 text-sm text-muted">
                Abra o arquivo no navegador e use Imprimir → salvar como PDF, se
                precisar.
              </p>
              {exportError ? (
                <p role="alert" className="m-0 text-critical">
                  {exportError}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ShortcutList({
  legend,
  description,
  pages,
  disabled,
  onSelect,
}: {
  legend: string;
  description?: string;
  pages: TestPageShortcut[];
  disabled: boolean;
  onSelect: (url: string) => void;
}) {
  return (
    <fieldset disabled={disabled} className="m-0 grid gap-3 border-0 p-0">
      <legend className="float-none w-full px-0 font-semibold">{legend}</legend>
      {description ? (
        <p className="m-0 text-sm text-muted">{description}</p>
      ) : null}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-border bg-peach px-3 py-1.5 text-sm font-medium text-primary transition-colors duration-200 hover:bg-accent hover:text-primary"
              onClick={() => onSelect(page.url)}
            >
              {page.label}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
