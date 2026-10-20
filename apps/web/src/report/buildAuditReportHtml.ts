import type { Violation } from "@mavi/shared";
import { SEVERITY_LABEL, SOURCE_LAYER_LABEL } from "../labels/violations.ts";
import { groupViolationsByIssue } from "./groupViolationsByIssue.ts";
import { groupViolationsByWcag } from "./groupViolationsByWcag.ts";
import { splitViolationsBySource } from "./splitViolationsBySource.ts";

export interface AuditReportInput {
  pageUrl: string;
  analyzedAt: Date | string;
  screenshotSrc: string;
  logoSrc?: string;
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
  return SOURCE_LAYER_LABEL[sourceLayer];
}

function renderLayerSection(
  title: string,
  emptyLabel: string,
  violations: Violation[],
): string {
  const groups = groupViolationsByWcag(violations);
  if (groups.length === 0) {
    return `
      <section>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(emptyLabel)}</p>
      </section>`;
  }

  const criteria = groups
    .map((group) => {
      const items = groupViolationsByIssue(group.violations)
        .map((issue) => {
          const snippets = issue.violations
            .map(
              (violation, index) => `
          <li>
            ${issue.violations.length > 1 ? `<p class="local">Local ${index + 1}</p>` : ""}
            <pre><code>${escapeHtml(violation.htmlSnippet)}</code></pre>
          </li>`,
            )
            .join("\n");

          return `
        <li>
          <p>${escapeHtml(issue.description)}</p>
          <p>Severidade: ${escapeHtml(SEVERITY_LABEL[issue.severity])}</p>
          <p>Origem: ${escapeHtml(sourceLabel(issue.sourceLayer))}</p>
          <ol class="snippets">
${snippets}
          </ol>
        </li>`;
        })
        .join("\n");

      return `
      <h3>${escapeHtml(group.wcagCriterion)}</h3>
      <ul>
${items}
      </ul>`;
    })
    .join("\n");

  return `
      <section>
        <h2>${escapeHtml(title)}</h2>
${criteria}
      </section>`;
}

export function buildAuditReportHtml(input: AuditReportInput): string {
  const analyzedAt = formatAnalyzedAt(input.analyzedAt);
  const { structural, visual } = splitViolationsBySource(input.violations);

  const violationSections = `${renderLayerSection(
    "Violações estruturais",
    "Nenhuma violação estrutural encontrada.",
    structural,
  )}
${renderLayerSection(
    "Violações visuais",
    "Nenhuma violação visual encontrada.",
    visual,
  )}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MAVI — Relatório de auditoria</title>
  <style>
    body { font-family: "Source Sans 3", system-ui, sans-serif; margin: 2rem; line-height: 1.6; color: #4A5568; background: #F7F5F0; }
    h1, h2, h3 { font-family: "Plus Jakarta Sans", system-ui, sans-serif; color: #14213D; }
    .eyebrow { color: #A8470F; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
    .brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
    .brand img { width: 48px; height: 48px; border: 0; background: transparent; }
    .screenshot { max-width: 100%; height: auto; border: 1px solid #141413; border-radius: 12px; }
    pre { background: #FFFEFB; padding: 0.75rem; border: 1px solid #141413; border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: visible; word-break: break-word; }
    section { margin-top: 1.5rem; }
    .snippets { padding-left: 1.25rem; }
    .local { color: #A8470F; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="brand">
    ${input.logoSrc ? `<img src="${escapeHtml(input.logoSrc)}" alt="">` : ""}
    <div>
      <p class="eyebrow">Auditoria</p>
      <h1>MAVI — Relatório de auditoria</h1>
    </div>
  </div>
  <p><strong>URL:</strong> ${escapeHtml(input.pageUrl)}</p>
  <p><strong>Analisado em:</strong> ${escapeHtml(analyzedAt)}</p>
  <p><img class="screenshot" src="${escapeHtml(input.screenshotSrc)}" alt="Screenshot de ${escapeHtml(input.pageUrl)}"></p>
${violationSections}
</body>
</html>
`;
}
