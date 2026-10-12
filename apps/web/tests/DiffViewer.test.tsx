import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffViewer } from "../src/components/DiffViewer.tsx";

describe("DiffViewer", () => {
  it("mostra HTML original e código corrigido lado a lado com explicação", () => {
    render(
      <DiffViewer
        diffBefore={'<img src="produto.jpg">'}
        diffAfter={'<img src="produto.jpg" alt="Foto do produto">'}
        explanation="Adicione um atributo alt descritivo à imagem."
      />,
    );

    expect(screen.getByText(/original/i)).toBeInTheDocument();
    expect(screen.getByText(/corrigido/i)).toBeInTheDocument();
    expect(screen.getByText('<img src="produto.jpg">')).toBeInTheDocument();
    expect(
      screen.getByText('<img src="produto.jpg" alt="Foto do produto">'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adicione um atributo alt descritivo à imagem."),
    ).toBeInTheDocument();
  });
});
