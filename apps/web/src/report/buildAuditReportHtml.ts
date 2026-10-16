import type { Violation } from "@mavi/shared";
import { groupViolationsByWcag } from "./groupViolationsByWcag.ts";

export interface AuditReportInput {
  pageUrl: string;
  analyzedAt: Date | string;
  screenshotSrc: string;
  violations: Violation[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAnalyzedAt(analyzedAt: Date | string): string {
  const date =
    analyzedAt instanceof Date ? analyzedAt : new Date(analyzedAt);
  if (Number.isNaN(date.getTime())) {
    return String(analyzedAt);
  }
  return date.toISOString();
}

function sourceLabel(sourceLayer: Violation["sourceLayer"]): string {
  switch (sourceLayer) {
    case "axe":
      return "axe";
    case "vision":
      return "vision";
    case "both":
      return "axe + vision";
  }
}

export function buildAuditReportHtml(input: AuditReportInput): string {
  const analyzedAt = formatAnalyzedAt(input.analyzedAt);
  const groups = groupViolationsByWcag(input.violations);

  const violationSections =
    groups.length === 0
      ? "<p>Nenhuma violação encontrada.</p>"
      : groups
          .map((group) => {
            const items = group.violations
              .map(
                (violation) => `
        <li>
          <p>${escapeHtml(violation.description)}</p>
          <p>Severidade: ${escapeHtml(violation.severity)}</p>
          <p>Origem: ${escapeHtml(sourceLabel(violation.sourceLayer))}</p>
          <pre><code>${escapeHtml(violation.htmlSnippet)}</code></pre>
        </li>`,
              )
              .join("\n");

            return `
      <section>
        <h2>${escapeHtml(group.wcagCriterion)}</h2>
        <ul>
${items}
        </ul>
      </section>`;
          })
          .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MAVI — Relatório de auditoria</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #111; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; }
    pre { background: #f4f4f4; padding: 0.75rem; overflow-x: auto; }
    section { margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>MAVI — Relatório de auditoria</h1>
  <p><strong>URL:</strong> ${escapeHtml(input.pageUrl)}</p>
  <p><strong>Analisado em:</strong> ${escapeHtml(analyzedAt)}</p>
  <p><img src="${escapeHtml(input.screenshotSrc)}" alt="Screenshot de ${escapeHtml(input.pageUrl)}"></p>
  <h2>Violações</h2>
${violationSections}
</body>
</html>
`;
}
