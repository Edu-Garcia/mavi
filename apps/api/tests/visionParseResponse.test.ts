import { describe, expect, it } from "vitest";
import { parseVisionResponse } from "../src/analysis/vision/parseVisionResponse.ts";

describe("parseVisionResponse", () => {
  it("extrai violações de JSON válido", () => {
    const raw = JSON.stringify({
      violations: [
        {
          wcagCriterion: "1.4.3 Contrast",
          description: "Texto cinza claro sobre fundo branco",
          location: "botão .cta no canto inferior direito",
          severity: "serious",
        },
      ],
    });

    const parsed = parseVisionResponse(raw);

    expect(parsed).toEqual([
      {
        wcagCriterion: "1.4.3 Contrast",
        description: "Texto cinza claro sobre fundo branco",
        location: "botão .cta no canto inferior direito",
        severity: "serious",
      },
    ]);
  });

  it("aceita JSON envolvido em fence markdown", () => {
    const raw = `Aqui está a análise:
\`\`\`json
{
  "violations": [
    {
      "wcagCriterion": "2.5.5 Target Size",
      "description": "Alvo de toque menor que 44x44 CSS pixels",
      "location": "ícone de menu no header",
      "severity": "moderate"
    }
  ]
}
\`\`\``;

    const parsed = parseVisionResponse(raw);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.wcagCriterion).toBe("2.5.5 Target Size");
    expect(parsed[0]?.severity).toBe("moderate");
  });

  it("retorna lista vazia quando o JSON está malformado", () => {
    expect(parseVisionResponse("{ not valid json")).toEqual([]);
    expect(parseVisionResponse("")).toEqual([]);
    expect(parseVisionResponse("null")).toEqual([]);
  });

  it("ignora itens incompletos e mantém os válidos", () => {
    const raw = JSON.stringify({
      violations: [
        {
          wcagCriterion: "1.4.3 Contrast",
          description: "Contraste insuficiente no título",
          location: "h1 principal",
          severity: "critical",
        },
        {
          wcagCriterion: "1.4.3 Contrast",
          description: "sem localização",
          severity: "serious",
        },
        {
          description: "sem critério",
          location: ".footer",
          severity: "minor",
        },
      ],
    });

    const parsed = parseVisionResponse(raw);

    expect(parsed).toEqual([
      {
        wcagCriterion: "1.4.3 Contrast",
        description: "Contraste insuficiente no título",
        location: "h1 principal",
        severity: "critical",
      },
    ]);
  });

  it("normaliza severidade desconhecida para moderate", () => {
    const raw = JSON.stringify({
      violations: [
        {
          wcagCriterion: "1.4.11 Non-text Contrast",
          description: "Ícone com baixo contraste",
          location: ".icon-close",
          severity: "high",
        },
      ],
    });

    expect(parseVisionResponse(raw)[0]?.severity).toBe("moderate");
  });
});
