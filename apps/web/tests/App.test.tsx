import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import type { AnalyzeUrlSuccess } from "../src/api/analyzeUrl.ts";
import type { AnalysisRun, Page, Violation } from "@mavi/shared";

function successResult(
  violations: Violation[] = [],
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
    screenshotUrl: "http://api.test/pages/page-1/screenshot",
  };
}

describe("App — submissão de URL", () => {
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

    expect(analyze).toHaveBeenCalledWith("https://example.com");
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
    expect(altGroup).toHaveTextContent("critical");
    expect(altGroup).toHaveTextContent('<img src="produto.jpg">');

    const headingGroup = screen.getByRole("region", {
      name: /critério 1\.3\.1 info and relationships/i,
    });
    expect(headingGroup).toHaveTextContent("Ordem de heading incorreta");
    expect(headingGroup).toHaveTextContent("moderate");
    expect(headingGroup).toHaveTextContent("<h3>Pula h2</h3>");
  });
});
