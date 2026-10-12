import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import type { AnalyzeUrlSuccess } from "../src/api/analyzeUrl.ts";
import type { AnalysisRun, Page } from "@mavi/shared";

function successResult(): AnalyzeUrlSuccess {
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
});
