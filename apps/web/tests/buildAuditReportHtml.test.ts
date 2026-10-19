import { describe, expect, it } from "vitest";
import type { Violation } from "@mavi/shared";
import { buildAuditReportHtml } from "../src/report/buildAuditReportHtml.ts";

describe("buildAuditReportHtml", () => {
  it("gera HTML autônomo com URL, timestamp, screenshot e violações por WCAG", () => {
    const violations: Violation[] = [
      {
        id: "v1",
        analysisRunId: "run-1",
        wcagCriterion: "1.1.1 Non-text Content",
        sourceLayer: "axe",
        description: "Imagem sem texto alternativo",
        htmlSnippet: '<img src="produto.jpg">',
        severity: "critical",
      },
      {
        id: "v2",
        analysisRunId: "run-1",
        wcagCriterion: "1.4.3 Contrast (Minimum)",
        sourceLayer: "vision",
        description: "Contraste insuficiente no texto",
        htmlSnippet: ".low-contrast",
        severity: "serious",
      },
    ];

    const html = buildAuditReportHtml({
      pageUrl: "https://example.com/",
      analyzedAt: new Date("2026-10-16T15:00:00.000Z"),
      screenshotSrc: "data:image/png;base64,abc123",
      violations,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("https://example.com/");
    expect(html).toContain("2026-10-16");
    expect(html).toContain('src="data:image/png;base64,abc123"');
    expect(html).toContain("<h2>Violações estruturais</h2>");
    expect(html).toContain("<h2>Violações visuais</h2>");
    expect(html.indexOf("Violações estruturais")).toBeLessThan(
      html.indexOf("Violações visuais"),
    );
    expect(html).toContain("1.1.1 Non-text Content");
    expect(html).toContain("Imagem sem texto alternativo");
    expect(html).toContain("Crítica");
    expect(html).toContain("Estrutural (axe)");
    expect(html).toContain("&lt;img src=&quot;produto.jpg&quot;&gt;");
    expect(html).toContain("1.4.3 Contrast (Minimum)");
    expect(html).toContain("Contraste insuficiente no texto");
    expect(html).toContain("Visual (Gemini)");
  });

  it("agrupa o mesmo erro e lista os trechos sem repetir a descrição", () => {
    const html = buildAuditReportHtml({
      pageUrl: "https://example.com/",
      analyzedAt: new Date("2026-10-16T15:00:00.000Z"),
      screenshotSrc: "data:image/png;base64,x",
      violations: [
        {
          id: "v1",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "As imagens devem ter texto alternativo",
          htmlSnippet: '<img src="a.jpg">',
          severity: "critical",
        },
        {
          id: "v2",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "As imagens devem ter texto alternativo",
          htmlSnippet: '<img src="b.jpg">',
          severity: "critical",
        },
      ],
    });

    expect(html.split("As imagens devem ter texto alternativo")).toHaveLength(2);
    expect(html).toContain("Local 1");
    expect(html).toContain("Local 2");
    expect(html).toContain("&lt;img src=&quot;a.jpg&quot;&gt;");
    expect(html).toContain("&lt;img src=&quot;b.jpg&quot;&gt;");
    expect(html).toContain("white-space: pre-wrap");
  });

  it("não inclui diffs nem sugestões de correção de código", () => {
    const html = buildAuditReportHtml({
      pageUrl: "https://example.com/",
      analyzedAt: new Date("2026-10-16T15:00:00.000Z"),
      screenshotSrc: "data:image/png;base64,x",
      violations: [
        {
          id: "v1",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "Imagem sem alt",
          htmlSnippet: "<img>",
          severity: "critical",
        },
      ],
    });

    expect(html.toLowerCase()).not.toContain("diff");
    expect(html.toLowerCase()).not.toContain("correção");
    expect(html.toLowerCase()).not.toContain("codigo corrigido");
    expect(html.toLowerCase()).not.toContain("código corrigido");
    expect(html).not.toContain("fixSuggestion");
  });
});
