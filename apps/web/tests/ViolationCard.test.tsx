import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FixSuggestion, Violation } from "@mavi/shared";
import { ViolationCard } from "../src/components/ViolationCard.tsx";

const violation: Violation = {
  id: "v1",
  analysisRunId: "run-1",
  wcagCriterion: "1.1.1 Non-text Content",
  sourceLayer: "axe",
  description: "Imagem sem texto alternativo",
  htmlSnippet: '<img src="produto.jpg">',
  severity: "critical",
};

const fixSuggestion: FixSuggestion = {
  id: "fix-1",
  violationId: "v1",
  diffBefore: '<img src="produto.jpg">',
  diffAfter: '<img src="produto.jpg" alt="Foto do produto">',
  explanation: "Adicione um atributo alt descritivo à imagem.",
  generatedAt: new Date("2026-01-15T12:00:45.000Z"),
};

describe("ViolationCard", () => {
  it("mostra descrição e severidade da violação", () => {
    render(<ViolationCard violation={violation} />);

    expect(
      screen.getByText("Imagem sem texto alternativo"),
    ).toBeInTheDocument();
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it("expande e mostra o diff da FixSuggestion", async () => {
    const user = userEvent.setup();
    render(
      <ViolationCard violation={violation} fixSuggestion={fixSuggestion} />,
    );

    expect(
      screen.queryByText("Adicione um atributo alt descritivo à imagem."),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /ver correção|mostrar diff|expandir/i }),
    );

    expect(
      screen.getByText("Adicione um atributo alt descritivo à imagem."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/código original/i)).toHaveTextContent(
      '<img src="produto.jpg">',
    );
    expect(screen.getByLabelText(/código corrigido/i)).toHaveTextContent(
      '<img src="produto.jpg" alt="Foto do produto">',
    );
  });

  it("sem FixSuggestion não oferece expandir diff", () => {
    render(<ViolationCard violation={violation} />);

    expect(
      screen.queryByRole("button", {
        name: /ver correção|mostrar diff|expandir/i,
      }),
    ).toBeNull();
  });
});
