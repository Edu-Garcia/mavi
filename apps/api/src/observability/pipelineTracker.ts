import type {
  PipelineStageDiagnostic,
  PipelineStageName,
  PipelineStageStatus,
} from "@mavi/shared";

export interface PipelineLogSink {
  write(line: string): void;
}

export interface PipelineTracker {
  readonly stages: PipelineStageDiagnostic[];
  record(
    name: PipelineStageName,
    status: PipelineStageStatus,
    durationMs: number,
    extra?: Record<string, unknown>,
  ): void;
}

export interface PipelineTrackerOptions {
  runId: string;
  url?: string;
  mode?: "audit" | "fix";
  sink?: PipelineLogSink;
}

const STAGE_LABEL: Record<PipelineStageName, string> = {
  start: "início",
  capture: "captura",
  axe: "axe",
  vision: "vision",
  merge: "cruzamento",
  groq: "groq",
  done: "conclusão",
};

const STATUS_LABEL: Record<PipelineStageStatus, string> = {
  ok: "ok",
  skipped: "pulado",
  error: "erro",
};

const SKIP_REASON_LABEL: Record<string, string> = {
  missing_key: "chave ausente",
  audit_mode: "modo auditoria",
};

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function summarizeLayerError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = (raw.split(/\r?\n/)[0] ?? raw).trim();

  const isGroq = /groq/i.test(firstLine);

  if (
    !isGroq &&
    /503/.test(raw) &&
    /high demand|UNAVAILABLE|alta demanda/i.test(raw)
  ) {
    return "Gemini 503 — alta demanda, tente de novo";
  }
  if (/429/.test(firstLine)) {
    if (isGroq) {
      const model = firstLine.match(/model=(\S+?)(?::|\s|$)/)?.[1];
      return model
        ? `Groq 429 — limite de requisições (${model})`
        : "Groq 429 — limite de requisições";
    }
    return "Gemini 429 — limite de requisições";
  }
  if (/\b401\b|\b403\b/.test(firstLine) && /gemini/i.test(firstLine)) {
    return "Gemini — chave inválida ou sem permissão";
  }
  if (/timeout/i.test(firstLine) && /gemini/i.test(firstLine)) {
    return "Gemini — tempo limite esgotado";
  }

  const withoutJson = firstLine.replace(/:\s*[\{\[].*$/s, "").trim();
  const compact = withoutJson || firstLine;
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact;
}

export function formatPipelineStageLine(
  name: PipelineStageName,
  status: PipelineStageStatus,
  durationMs: number,
  extra: Record<string, unknown> = {},
): string {
  const label = STAGE_LABEL[name].padEnd(12);
  const statusText = STATUS_LABEL[status].padEnd(6);
  const time = formatDuration(durationMs).padStart(6);
  const detail = formatStageDetail(extra);
  return `  ${label} ${statusText} ${time}${detail ? `   ${detail}` : ""}`;
}

function formatStageDetail(extra: Record<string, unknown>): string {
  if (typeof extra.violationCount === "number") {
    return extra.violationCount === 1
      ? "1 violação"
      : `${extra.violationCount} violações`;
  }
  if (typeof extra.suggestionCount === "number") {
    return extra.suggestionCount === 1
      ? "1 sugestão"
      : `${extra.suggestionCount} sugestões`;
  }
  if (typeof extra.skippedReason === "string") {
    return SKIP_REASON_LABEL[extra.skippedReason] ?? extra.skippedReason;
  }
  if (typeof extra.error === "string" && extra.error.trim()) {
    return extra.error;
  }
  return "";
}

function defaultSink(): PipelineLogSink | undefined {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return undefined;
  }
  return {
    write(line) {
      console.log(line);
    },
  };
}

export function createPipelineTracker(
  options: PipelineTrackerOptions,
): PipelineTracker {
  const stages: PipelineStageDiagnostic[] = [];
  const sink = options.sink ?? defaultSink();
  const modeLabel =
    options.mode === "audit" ? "modo auditoria" : "modo com correções";

  return {
    stages,
    record(name, status, durationMs, extra = {}) {
      stages.push({ name, status, durationMs });

      if (!sink) {
        return;
      }

      if (name === "start") {
        sink.write("");
        sink.write(`MAVI  análise  ${modeLabel}`);
        if (options.url) {
          sink.write(`URL   ${options.url}`);
        }
        sink.write("");
        return;
      }

      if (name === "done") {
        sink.write("");
        sink.write(`concluído em ${formatDuration(durationMs)}`);
        sink.write("");
        return;
      }

      sink.write(formatPipelineStageLine(name, status, durationMs, extra));
    },
  };
}

export function errorMessage(error: unknown): string {
  return summarizeLayerError(error);
}
