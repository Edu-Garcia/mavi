import { useState, type FormEvent } from "react";
import {
  analyzeUrl as defaultAnalyzeUrl,
  type AnalyzeUrlSuccess,
} from "./api/analyzeUrl.ts";
import { ViolationsReport } from "./components/ViolationsReport.tsx";

export type { Page } from "@mavi/shared";

export type AnalyzeFn = (url: string) => Promise<AnalyzeUrlSuccess>;

export interface AppProps {
  analyze?: AnalyzeFn;
}

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: AnalyzeUrlSuccess }
  | { status: "error"; message: string };

export function App({ analyze = defaultAnalyzeUrl }: AppProps) {
  const [url, setUrl] = useState("");
  const [view, setView] = useState<ViewState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView({ status: "loading" });
    try {
      const result = await analyze(url.trim());
      setView({ status: "ready", result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao analisar URL";
      setView({ status: "error", message });
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
          <img
            src={view.result.screenshotUrl}
            alt={`Screenshot de ${view.result.page.url}`}
          />
          <ViolationsReport
            violations={view.result.violations}
            fixSuggestions={view.result.fixSuggestions}
          />

        </section>
      ) : null}
    </main>
  );
}
