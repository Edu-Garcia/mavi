import type { AnalyzeDiagnostics } from "@mavi/shared";

export interface DiagnosticsPanelProps {
  diagnostics: AnalyzeDiagnostics;
}

const STAGE_LABEL: Record<string, string> = {
  start: "Início",
  capture: "Captura",
  axe: "Análise estrutural (axe)",
  vision: "Análise visual (Gemini)",
  merge: "Cruzamento",
  groq: "Sugestões de código (Groq)",
  done: "Concluído",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "ok",
  skipped: "pulada",
  error: "erro",
};

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  return (
    <section
      aria-label="O que rodou nesta análise"
      className="rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <h2 className="mt-0 mb-3 font-display text-lg font-semibold text-primary">
        O que rodou nesta análise
      </h2>
      <ul className="m-0 grid list-none gap-2 p-0 text-sm">
        {diagnostics.stages.map((stage) => (
          <li
            key={`${stage.name}-${stage.status}-${stage.durationMs}`}
            className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
          >
            <span>{STAGE_LABEL[stage.name] ?? stage.name}</span>
            <span className="text-muted">
              {STATUS_LABEL[stage.status] ?? stage.status} ({stage.durationMs}{" "}
              ms)
            </span>
          </li>
        ))}
      </ul>
      <p className="mb-0 mt-4 text-sm text-muted">
        Chaves: Gemini {diagnostics.keys.gemini ? "presente" : "ausente"}, Groq{" "}
        {diagnostics.keys.groq ? "presente" : "ausente"}
      </p>
    </section>
  );
}
