import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  geminiMustFindPassed,
  geminiMustNotFindPassed,
} from "./assertValidation.ts";
import { EXTRA_AXE_RULE_IDS } from "./extraRules.ts";
import type {
  BenchmarkPageRoundRecord,
  FailureCaseRecord,
  LayerConfiguration,
  PrecisionCoverageSummary,
  ValidationRoundRecord,
} from "./types.ts";
import {
  STRUCTURAL_BENCHMARK_IDS,
  VISUAL_BENCHMARK_IDS,
} from "./types.ts";

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function meanMinMax(values: number[]): { mean: number; min: number; max: number } {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  return { mean, min, max };
}

function formatRange(stats: { mean: number; min: number; max: number }): string {
  return `${formatPct(stats.mean)} (min ${formatPct(stats.min)}, máx ${formatPct(stats.max)})`;
}

export function validationCsv(records: ValidationRoundRecord[]): string {
  const header = [
    "page",
    "mode",
    "round",
    "status",
    "assertion",
    "expected",
    "found",
    "passed",
  ];
  const rows = records.flatMap((record) =>
    record.assertions.map((assertion) =>
      [
        record.pageId,
        record.mode,
        record.round,
        record.status,
        assertion.id,
        assertion.expected,
        assertion.found,
        assertion.passed,
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  if (rows.length === 0) {
    rows.push(["", "", "", "", "", "", "", ""].join(","));
  }
  return `${[header.join(","), ...rows].join("\n")}\n`;
}

export function benchmarkCsv(records: BenchmarkPageRoundRecord[]): string {
  const header = [
    "page",
    "configuration",
    "precisionMode",
    "round",
    "status",
    "vp",
    "fp",
    "fn",
    "precision",
    "recall",
    "fpRules",
    "visualExclusive",
    "whoFound",
  ];
  const rows = records.flatMap((record) =>
    record.scores.map((score) =>
      [
        record.pageId,
        score.configuration,
        score.precisionMode,
        record.round,
        record.status,
        score.score.truePositives,
        score.score.falsePositives,
        score.score.falseNegatives,
        score.score.truePositives /
          Math.max(1, score.score.truePositives + score.score.falsePositives),
        score.score.truePositives /
          Math.max(1, score.score.truePositives + score.score.falseNegatives),
        score.falsePositiveRules.join("|"),
        record.visualExclusive ?? "",
        (record.whoFound ?? []).join("|"),
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  return `${[header.join(","), ...rows].join("\n")}\n`;
}

interface ConfigRoundMetrics {
  recallStructural: number;
  recallVisual: number;
  precisionStrict: number;
  precisionWithoutExtras: number;
  vpStructural: number;
  vpVisual: number;
}

function metricsForRound(
  records: BenchmarkPageRoundRecord[],
  round: number,
  configuration: LayerConfiguration,
): ConfigRoundMetrics | null {
  const pages = records.filter((record) => {
    if (record.round !== round) {
      return false;
    }
    if (record.status === "lost") {
      return false;
    }
    if (configuration === "visual") {
      return record.status === "completed";
    }
    return record.status === "completed" || record.status === "incomplete";
  });
  if (pages.length === 0) {
    return null;
  }
  const pick = (pageId: string, precisionMode: "strict" | "without-extras") =>
    pages
      .find((record) => record.pageId === pageId)
      ?.scores.find(
        (score) =>
          score.configuration === configuration &&
          score.precisionMode === precisionMode,
      );

  let vpStructural = 0;
  for (const pageId of STRUCTURAL_BENCHMARK_IDS) {
    vpStructural += pick(pageId, "strict")?.score.truePositives ?? 0;
  }
  let vpVisual = 0;
  for (const pageId of VISUAL_BENCHMARK_IDS) {
    vpVisual += pick(pageId, "strict")?.score.truePositives ?? 0;
  }

  let vpStrict = 0;
  let fpStrict = 0;
  let vpLoose = 0;
  let fpLoose = 0;
  for (const record of pages) {
    const strict = pick(record.pageId, "strict");
    const loose = pick(record.pageId, "without-extras");
    if (strict) {
      vpStrict += strict.score.truePositives;
      fpStrict += strict.score.falsePositives;
    }
    if (loose) {
      vpLoose += loose.score.truePositives;
      fpLoose += loose.score.falsePositives;
    }
  }

  return {
    recallStructural: ratio(vpStructural, 4),
    recallVisual: ratio(vpVisual, 2),
    precisionStrict: ratio(vpStrict, vpStrict + fpStrict),
    precisionWithoutExtras: ratio(vpLoose, vpLoose + fpLoose),
    vpStructural,
    vpVisual,
  };
}

function aggregateConfiguration(
  records: BenchmarkPageRoundRecord[],
  configuration: LayerConfiguration,
): {
  recallStructural: ReturnType<typeof meanMinMax>;
  recallVisual: ReturnType<typeof meanMinMax>;
  precisionStrict: ReturnType<typeof meanMinMax>;
  precisionWithoutExtras: ReturnType<typeof meanMinMax>;
  last?: ConfigRoundMetrics;
} {
  const rounds = [...new Set(records.map((record) => record.round))].sort();
  const metrics = rounds
    .map((round) => metricsForRound(records, round, configuration))
    .filter((item): item is ConfigRoundMetrics => item !== null);
  return {
    recallStructural: meanMinMax(metrics.map((item) => item.recallStructural)),
    recallVisual: meanMinMax(metrics.map((item) => item.recallVisual)),
    precisionStrict: meanMinMax(metrics.map((item) => item.precisionStrict)),
    precisionWithoutExtras: meanMinMax(
      metrics.map((item) => item.precisionWithoutExtras),
    ),
    last: metrics[metrics.length - 1],
  };
}

function visualExclusiveSummary(records: BenchmarkPageRoundRecord[]): {
  hits: number;
  total: number;
  byPage: Record<string, number>;
} {
  const visual = records.filter(
    (record) =>
      (VISUAL_BENCHMARK_IDS as readonly string[]).includes(record.pageId) &&
      record.status === "completed",
  );
  const byPage: Record<string, number> = {
    "dynamic-contrast": 0,
    "inadequate-touch-targets": 0,
  };
  let hits = 0;
  for (const record of visual) {
    if (record.visualExclusive) {
      hits += 1;
      byPage[record.pageId] = (byPage[record.pageId] ?? 0) + 1;
    }
  }
  return { hits, total: visual.length, byPage };
}

function failedAssertions(records: ValidationRoundRecord[]): string[] {
  return records.flatMap((record) =>
    record.assertions
      .filter((assertion) => !assertion.passed)
      .map(
        (assertion) =>
          `${record.pageId} ${record.mode} r${record.round} — ${assertion.id}: esperado ${assertion.expected}; encontrado ${assertion.found}`,
      ),
  );
}

function missedViolations(records: BenchmarkPageRoundRecord[]): string[] {
  return records
    .filter((record) => record.status === "completed" || record.status === "incomplete")
    .filter((record) =>
      record.scores.some(
        (score) =>
          score.configuration === "complete" &&
          score.precisionMode === "strict" &&
          score.score.falseNegatives > 0,
      ),
    )
    .map((record) => {
      const complete = record.scores.find(
        (score) =>
          score.configuration === "complete" && score.precisionMode === "strict",
      );
      return `${record.pageId} r${record.round}: FN=${complete?.score.falseNegatives} (quem achou: ${(record.whoFound ?? []).join(", ") || "ninguém"})`;
    });
}

export function renderResumo(summary: PrecisionCoverageSummary): string {
  const configs: Array<{ id: LayerConfiguration; label: string }> = [
    { id: "structural", label: "Só estrutural (axe)" },
    { id: "visual", label: "Só visual (Gemini)" },
    { id: "complete", label: "MAVI completo" },
  ];
  const exclusive = visualExclusiveSummary(summary.benchmark);
  const failed = failedAssertions(summary.validation);
  const missed = missedViolations(summary.benchmark);
  const incompleteBenchmark = summary.benchmark.filter(
    (record) => record.status !== "completed",
  );
  const incompleteValidation = summary.validation.filter(
    (record) => record.status === "lost" || record.status === "incomplete",
  );
  const lost = [
    `${incompleteValidation.length} registros de validação incompletos/perdidos (visão 503/timeout/429).`,
    `${incompleteBenchmark.length} registros de benchmark incompletos (visão 429). O score estrutural dessas rodadas foi mantido; a camada visual não entrou como recall 0.`,
  ];

  const tableRows = configs.map((config) => {
    const stats = aggregateConfiguration(summary.benchmark, config.id);
    const visualGtCompleted = summary.benchmark.filter(
      (record) =>
        record.status === "completed" &&
        (VISUAL_BENCHMARK_IDS as readonly string[]).includes(record.pageId),
    ).length;
    if (config.id === "visual" && visualGtCompleted === 0) {
      return `| ${config.label} | incompleto (visão 429/503) | incompleto (visão 429/503) | — | — |`;
    }
    return `| ${config.label} | ${stats.last?.vpStructural ?? 0} de 4 (${formatRange(stats.recallStructural)}) | ${stats.last?.vpVisual ?? 0} de 2 (${formatRange(stats.recallVisual)}) | ${formatRange(stats.precisionStrict)} | ${formatRange(stats.precisionWithoutExtras)} |`;
  });

  const failureLines = summary.failures.map(
    (item) =>
      `- ${item.passed ? "PASS" : "FAIL"} \`${item.id}\` (${item.pages.join(", ")}): ${item.found}`,
  );

  const anecdotes = validationVisionAnecdotes(summary.validation);
  const visualLine =
    exclusive.total === 0
      ? "No **benchmark CLI**, a visão ficou incompleta (Gemini 429/503), então o número exclusivo da visão no gabarito ainda não pontuou."
      : `No **benchmark CLI**, a visão (e só a visão) encontrou o gabarito visual em **${exclusive.hits} de ${exclusive.total}** observações completas.`;

  return `# MAVI — Rodada de precisão e cobertura

Gerado em ${summary.ambiente.collectedAt}. Pasta: \`${summary.outDir}\`. Modelo: \`${summary.ambiente.models.gemini}\`.

## Número para o slide

${visualLine}

${anecdotes}

## Tabela para o slide

Médias das ${summary.rounds} rodadas (mínimo e máximo entre parênteses). Recall estrutural é sobre as 4 páginas só-axe; recall visual sobre as 2 páginas só-visão. A coluna “de N” da última rodada completa aparece à esquerda do percentual.

| Configuração | Recall estrutural (de 4) | Recall visual (de 2) | Precisão estrita | Precisão sem extras |
| --- | --- | --- | --- | --- |
${tableRows.join("\n")}

Lista fixa ignorada na precisão sem extras: \`${EXTRA_AXE_RULE_IDS.join("`, `")}\`.

## Ambiente

- Node ${summary.ambiente.node} (${summary.ambiente.platform}/${summary.ambiente.arch})
- Playwright ${summary.ambiente.playwright} — ${summary.ambiente.playwrightBrowser.name} ${summary.ambiente.playwrightBrowser.version}
- axe-core ${summary.ambiente.axeCore}
- Janela ${summary.ambiente.captureViewport.width}×${summary.ambiente.captureViewport.height}
- Gemini ${summary.ambiente.models.gemini}
- Groq ${summary.ambiente.models.groq}
- Prompt de visão \`${summary.ambiente.prompts.vision}\`

## Agregação Gemini (5 rodadas)

Uma asserção “deve achar” passa se aparecer em pelo menos 4 das 5. Uma “não deve achar” falha se aparecer em 2 ou mais. Contagem real abaixo (modos auditoria e com sugestões somados à parte).

${geminiAggregationMarkdown(summary.validation)}

## Violações perdidas (FN no MAVI completo, precisão estrita)

${missed.length === 0 ? "Nenhuma." : missed.map((item) => `- ${item}`).join("\n")}

## Asserções de validação que falharam

${failed.length === 0 ? "Nenhuma." : failed.map((item) => `- ${item}`).join("\n")}

## Casos de saída e falha

${failureLines.join("\n")}

## Rodadas perdidas ou incompletas

${lost.length === 0 ? "Nenhuma." : lost.map((item) => `- ${item}`).join("\n")}

## Fixtures (bugs plantados)

\`git diff\` de \`validation/pages\` e \`benchmark/pages\`:

\`\`\`
${summary.fixtureDiff.trim() || "(sem alterações)"}
\`\`\`

## Escolhas feitas nesta implementação

${summary.choices.map((item) => `- ${item}`).join("\n")}
`;
}

export async function writeCampaignReport(
  summary: PrecisionCoverageSummary,
): Promise<void> {
  await mkdir(summary.outDir, { recursive: true });
  await writeFile(
    path.join(summary.outDir, "ambiente.json"),
    `${JSON.stringify(summary.ambiente, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(summary.outDir, "validacao.csv"),
    validationCsv(summary.validation),
    "utf8",
  );
  await writeFile(
    path.join(summary.outDir, "benchmark.csv"),
    benchmarkCsv(summary.benchmark),
    "utf8",
  );
  await writeFile(
    path.join(summary.outDir, "resumo.md"),
    renderResumo(summary),
    "utf8",
  );
  await writeFile(
    path.join(summary.outDir, "falhas.json"),
    `${JSON.stringify(summary.failures, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(summary.outDir, "state.json"),
    `${JSON.stringify(
      {
        ambiente: summary.ambiente,
        rounds: summary.rounds,
        validation: summary.validation,
        benchmark: summary.benchmark,
        failures: summary.failures,
        choices: summary.choices,
        fixtureDiff: summary.fixtureDiff,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

const GEMINI_MUST_FIND = new Set([
  "visual-contrast-hero",
  "visual-touch-target",
  "visual-contrast-and-targets",
]);

const GEMINI_MUST_NOT_FIND = new Set([
  "visual-empty",
  "visual-not-source-of-alt-heading-link",
]);

function validationVisionAnecdotes(records: ValidationRoundRecord[]): string {
  const hits = records.filter(
    (record) =>
      record.status === "completed" &&
      record.assertions.some(
        (item) => item.id === "visual-contrast-hero" && item.passed,
      ) &&
      record.assertions.some(
        (item) => item.id === "visual-touch-target" && item.passed,
      ),
  );
  const mixed = records.filter(
    (record) =>
      record.status === "completed" &&
      record.assertions.some(
        (item) => item.id === "visual-contrast-and-targets" && item.passed,
      ),
  );
  const lines: string[] = [];
  if (hits.length > 0) {
    lines.push(
      `- \`02-somente-visuais\`: ${hits.length} rodada(s) em que a visual achou **1.4.3 no hero e 2.5.x nos alvos**.`,
    );
  }
  if (mixed.length > 0) {
    lines.push(
      `- \`04-visuais-e-estruturais\`: ${mixed.length} rodada(s) em que a visual achou contraste do banner **e** alvos pequenos.`,
    );
  }
  return lines.length === 0
    ? "Nenhuma rodada de validação completou as duas provas visuais nesta pasta."
    : lines.join("\n");
}

function geminiAggregationMarkdown(records: ValidationRoundRecord[]): string {
  const completed = records.filter((record) => record.status === "completed");
  const keys = new Map<
    string,
    { pageId: string; mode: string; assertionId: string; found: number; rounds: number; kind: "must_find" | "must_not_find" }
  >();
  for (const record of completed) {
    for (const assertion of record.assertions) {
      const kind = GEMINI_MUST_FIND.has(assertion.id)
        ? "must_find"
        : GEMINI_MUST_NOT_FIND.has(assertion.id)
          ? "must_not_find"
          : null;
      if (!kind) {
        continue;
      }
      const key = `${record.pageId}|${record.mode}|${assertion.id}`;
      const current = keys.get(key) ?? {
        pageId: record.pageId,
        mode: record.mode,
        assertionId: assertion.id,
        found: 0,
        rounds: 0,
        kind,
      };
      current.rounds += 1;
      if (kind === "must_find" && assertion.passed) {
        current.found += 1;
      }
      if (kind === "must_not_find" && !assertion.passed) {
        current.found += 1;
      }
      keys.set(key, current);
    }
  }
  const lines = [...keys.values()].map((item) => {
    const passed =
      item.kind === "must_find"
        ? geminiMustFindPassed(item.found, item.rounds)
        : geminiMustNotFindPassed(item.found, item.rounds);
    const rule =
      item.kind === "must_find" ? "deve achar (≥4/5)" : "não deve achar (falha se ≥2)";
    return `- ${passed ? "PASS" : "FAIL"} ${item.pageId} ${item.mode} \`${item.assertionId}\` — ${rule}: ${item.found}/${item.rounds}`;
  });
  return lines.length === 0 ? "Sem asserções visuais agregadas nesta pasta." : lines.join("\n");
}

export type { FailureCaseRecord };
