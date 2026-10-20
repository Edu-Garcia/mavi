import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import {
  AnalyzeUrlError,
  type AnalyzeUrlSuccess,
} from "../src/api/analyzeUrl.ts";
import {
  emptyAnalyzeDiagnostics,
  type AnalysisRun,
  type FixSuggestion,
  type Page,
  type Violation,
} from "@mavi/shared";

function successResult(
  violations: Violation[] = [],
  fixSuggestions: FixSuggestion[] = [],
): AnalyzeUrlSuccess {
  const page: Page = {
    id: "page-1",
    url: "https://example.com",
    capturedHtml: "<html></html>",
    screenshotPath: "/data/shot.png",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const analysisRun: AnalysisRun = {
    id: "run-1",
    pageId: "page-1",
    status: "completed",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:00:01.000Z"),
    modelVersions: {},
  };
  return {
    page,
    analysisRun,
    violations,
    fixSuggestions,
    screenshotUrl: "http://api.test/pages/page-1/screenshot",
    axeHtmlUrl: "http://api.test/pages/page-1/axe-html",
    diagnostics: emptyAnalyzeDiagnostics(),
  };
}

describe("App — submissão de URL", () => {
  it("mostra a logo do MAVI no cabeçalho e no título", () => {
    render(<App analyze={vi.fn()} />);

    expect(
      document.querySelectorAll('img[src="/mavi-logo.svg"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      document.querySelectorAll('img[src="/mavi-logo-light.svg"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("mostra loading e depois o screenshot da Page", async () => {
    const user = userEvent.setup();
    let resolveAnalyze!: (value: AnalyzeUrlSuccess) => void;
    const analyze = vi.fn(
      () =>
        new Promise<AnalyzeUrlSuccess>((resolve) => {
          resolveAnalyze = resolve;
        }),
    );

    render(<App analyze={analyze} />);

    await user.type(
      screen.getByLabelText(/url/i),
      "https://example.com",
    );
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    expect(analyze).toHaveBeenCalledWith("https://example.com", {
      mode: "fix",
    });
    expect(screen.getByText(/analisando/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /screenshot/i })).toBeNull();

    resolveAnalyze(successResult());

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /screenshot/i })).toHaveAttribute(
        "src",
        "http://api.test/pages/page-1/screenshot",
      );
    });
    expect(screen.queryByText(/analisando/i)).toBeNull();
  });

  it("agrupa violações por critério WCAG e mostra descrição, severidade e snippet", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () =>
      successResult([
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
          wcagCriterion: "1.3.1 Info and Relationships",
          sourceLayer: "axe",
          description: "Ordem de heading incorreta",
          htmlSnippet: "<h3>Pula h2</h3>",
          severity: "moderate",
        },
      ]),
    );

    render(<App analyze={analyze} />);

    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: /critério 1\.1\.1 non-text content/i,
        }),
      ).toBeInTheDocument();
    });

    const altGroup = screen.getByRole("region", {
      name: /critério 1\.1\.1 non-text content/i,
    });
    expect(altGroup).toHaveTextContent("Imagem sem texto alternativo");
    expect(altGroup).toHaveTextContent("Crítica");
    expect(altGroup).toHaveTextContent('<img src="produto.jpg">');

    const headingGroup = screen.getByRole("region", {
      name: /critério 1\.3\.1 info and relationships/i,
    });
    expect(headingGroup).toHaveTextContent("Ordem de heading incorreta");
    expect(headingGroup).toHaveTextContent("Moderada");
    expect(headingGroup).toHaveTextContent("<h3>Pula h2</h3>");
    expect(
      screen.getByRole("region", { name: /violações estruturais/i }),
    ).toHaveTextContent("Imagem sem texto alternativo");
    expect(
      screen.getByRole("region", { name: /violações visuais/i }),
    ).toHaveTextContent("Nenhuma violação visual encontrada.");
    expect(
      screen.getByRole("link", { name: /abrir html analisado pelo axe/i }),
    ).toHaveAttribute("href", "http://api.test/pages/page-1/axe-html");
  });

  it("agrupa o mesmo erro estrutural e lista os trechos sem repetir a descrição", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () =>
      successResult([
        {
          id: "v1",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "As imagens devem ter texto alternativo",
          htmlSnippet: '<img src="produto.jpg">',
          severity: "critical",
        },
        {
          id: "v2",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "As imagens devem ter texto alternativo",
          htmlSnippet: '<img src="banner.jpg">',
          severity: "critical",
        },
      ]),
    );

    render(<App analyze={analyze} />);
    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(
        screen.getByText("As imagens devem ter texto alternativo"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getAllByText("As imagens devem ter texto alternativo"),
    ).toHaveLength(1);
    expect(screen.getByLabelText("Trecho HTML 1")).toHaveTextContent(
      '<img src="produto.jpg">',
    );
    expect(screen.getByLabelText("Trecho HTML 2")).toHaveTextContent(
      '<img src="banner.jpg">',
    );
  });

  it("mostra violação vision no relatório", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () =>
      successResult([
        {
          id: "v-vision",
          analysisRunId: "run-1",
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          sourceLayer: "vision",
          description: "Contraste dinâmico insuficiente",
          htmlSnippet: ".low-contrast-text",
          severity: "serious",
        },
      ]),
    );

    render(<App analyze={analyze} />);
    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: /critério 1\.4\.3 contrast \(minimum\)/i,
        }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Contraste dinâmico insuficiente")).toBeInTheDocument();
    expect(screen.getByText(".low-contrast-text")).toBeInTheDocument();
    const structural = screen.getByRole("region", {
      name: /violações estruturais/i,
    });
    const visual = screen.getByRole("region", { name: /violações visuais/i });
    expect(structural).toHaveTextContent("Nenhuma violação estrutural encontrada.");
    expect(visual).toHaveTextContent("Contraste dinâmico insuficiente");
    expect(visual).not.toHaveTextContent("Nenhuma violação visual encontrada.");
  });

  it("em modo auditoria analisa sem correções e permite exportar HTML", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () =>
      successResult([
        {
          id: "v1",
          analysisRunId: "run-1",
          wcagCriterion: "1.1.1 Non-text Content",
          sourceLayer: "axe",
          description: "Imagem sem texto alternativo",
          htmlSnippet: "<img>",
          severity: "critical",
        },
      ]),
    );
    const downloadReport = vi.fn();
    const fetchScreenshotAsDataUrl = vi.fn(async () => "data:image/png;base64,xx");

    render(
      <App
        analyze={analyze}
        downloadReport={downloadReport}
        fetchScreenshotAsDataUrl={fetchScreenshotAsDataUrl}
      />,
    );

    await user.click(
      screen.getByRole("radio", { name: /auditoria \(sem correções de código\)/i }),
    );
    await user.type(screen.getByLabelText(/^url$/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(analyze).toHaveBeenCalledWith("https://example.com", {
        mode: "audit",
      });
    });
    expect(
      screen.getByText(/relatório de auditoria — sem sugestões de código/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ver correção/i }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /exportar relatório html/i }),
    );

    await waitFor(() => {
      expect(fetchScreenshotAsDataUrl).toHaveBeenCalledWith(
        "http://api.test/pages/page-1/screenshot",
      );
      expect(downloadReport).toHaveBeenCalledOnce();
    });

    const [html, filename] = downloadReport.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^mavi-auditoria-.*\.html$/);
    expect(html).toContain("https://example.com");
    expect(html).toContain("Imagem sem texto alternativo");
    expect(html.toLowerCase()).not.toContain("código corrigido");
  });

  it("mostra mensagem amigável quando a análise falha por timeout", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () => {
      throw new AnalyzeUrlError({
        reason: "timeout",
        message: "Timeout 60000ms exceeded.",
      });
    });

    render(<App analyze={analyze} />);
    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "A página demorou demais para carregar. Tente de novo ou use uma URL mais rápida.",
      );
    });
    expect(screen.queryByText(/Timeout 60000ms/i)).toBeNull();
  });

  it("expande o card e mostra o diff de correção", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () =>
      successResult(
        [
          {
            id: "v1",
            analysisRunId: "run-1",
            wcagCriterion: "1.1.1 Non-text Content",
            sourceLayer: "axe",
            description: "Imagem sem texto alternativo",
            htmlSnippet: "<img>",
            severity: "critical",
          },
        ],
        [
          {
            id: "fix-1",
            violationId: "v1",
            diffBefore: "<img>",
            diffAfter: '<img alt="Produto">',
            explanation: "Adicionar texto alternativo.",
            generatedAt: new Date("2026-01-01T00:00:02.000Z"),
          },
        ],
      ),
    );

    render(<App analyze={analyze} />);

    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ver correção/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ver correção/i }));

    const original = screen.getByRole("region", { name: /código original/i });
    const corrected = screen.getByRole("region", { name: /código corrigido/i });
    expect(original).toHaveTextContent("<img>");
    expect(corrected).toHaveTextContent('<img alt="Produto">');
    expect(
      screen.getByText("Adicionar texto alternativo."),
    ).toBeInTheDocument();
  });

  it("mostra etapas da análise enquanto carrega", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(() => new Promise<AnalyzeUrlSuccess>(() => {}));

    render(<App analyze={analyze} />);
    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    expect(screen.getByLabelText(/etapas da análise/i)).toHaveTextContent(
      "Capturar página",
    );
    expect(screen.getByLabelText(/etapas da análise/i)).toHaveTextContent(
      "Análise visual (Gemini)",
    );
  });

  it("mostra aviso quando a camada visual não rodou por falta de chave", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () => {
      const result = successResult();
      result.diagnostics = {
        ...emptyAnalyzeDiagnostics(),
        vision: {
          attempted: false,
          skippedReason: "missing_key",
          violationCount: 0,
        },
        keys: { gemini: false, groq: false },
      };
      return result;
    });

    render(<App analyze={analyze} />);
    await user.type(screen.getByLabelText(/url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /analisar/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /GEMINI_API_KEY ausente/i,
      );
    });
    expect(
      screen.getByRole("region", { name: /o que rodou nesta análise/i }),
    ).toBeInTheDocument();
  });

  it("preenche a URL com uma página de teste", async () => {
    const user = userEvent.setup();
    render(<App analyze={vi.fn()} apiBaseUrl="http://localhost:3000" />);

    await user.click(
      screen.getByRole("button", { name: /validação — só visuais/i }),
    );

    expect(screen.getByLabelText(/^url$/i)).toHaveValue(
      "http://localhost:3000/fixtures/validation/02-somente-visuais.html",
    );
  });

  it("preenche a URL com uma página do levantamento Datacorp", async () => {
    const user = userEvent.setup();
    render(<App analyze={vi.fn()} apiBaseUrl="http://localhost:3000" />);

    expect(
      screen.getByRole("group", { name: /levantamento datacorp/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /datacorp — formulário sem rótulo/i }),
    );

    expect(screen.getByLabelText(/^url$/i)).toHaveValue(
      "http://localhost:3000/fixtures/datacorp/formulario.html",
    );
  });
});
