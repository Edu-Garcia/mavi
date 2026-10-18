import { describe, expect, it, vi } from "vitest";
import type { Violation } from "@mavi/shared";
import { generateFixSuggestions } from "../src/fix-generation/generateFixSuggestions.ts";
import type { GroqClient } from "../src/clients/groq.ts";

function sampleViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "violation-1",
    analysisRunId: "run-1",
    wcagCriterion: "1.1.1 Non-text Content",
    sourceLayer: "axe",
    description: "Imagem sem texto alternativo",
    htmlSnippet: '<img src="produto.jpg">',
    severity: "critical",
    ...overrides,
  };
}

describe("generateFixSuggestions", () => {
  it("gera uma FixSuggestion com before, after e explanation por violação", async () => {
    const groqClient: GroqClient = {
      chatCompletion: vi.fn(async () => ({
        content: JSON.stringify({
          diffBefore: '<img src="produto.jpg">',
          diffAfter: '<img src="produto.jpg" alt="Foto do produto">',
          explanation: "Adicione um atributo alt descritivo à imagem.",
        }),
      })),
    };

    const suggestions = await generateFixSuggestions(
      [sampleViolation()],
      "<html><body><img src=\"produto.jpg\"></body></html>",
      { groqClient },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      violationId: "violation-1",
      diffBefore: '<img src="produto.jpg">',
      diffAfter: '<img src="produto.jpg" alt="Foto do produto">',
      explanation: "Adicione um atributo alt descritivo à imagem.",
    });
    expect(suggestions[0]?.id.length).toBeGreaterThan(0);
    expect(suggestions[0]?.generatedAt).toBeInstanceOf(Date);
  });

  it("gera uma FixSuggestion por violação quando há várias", async () => {
    const responses = [
      {
        diffBefore: "<img>",
        diffAfter: '<img alt="a">',
        explanation: "Alt para a.",
      },
      {
        diffBefore: "<h1></h1><h3></h3>",
        diffAfter: "<h1></h1><h2></h2>",
        explanation: "Corrija a ordem dos headings.",
      },
    ];
    let call = 0;
    const groqClient: GroqClient = {
      chatCompletion: vi.fn(async () => ({
        content: JSON.stringify(responses[call++]),
      })),
    };

    const suggestions = await generateFixSuggestions(
      [
        sampleViolation({ id: "v1" }),
        sampleViolation({
          id: "v2",
          wcagCriterion: "1.3.1 Info and Relationships",
          description: "Ordem de heading inválida",
          htmlSnippet: "<h1></h1><h3></h3>",
          severity: "moderate",
        }),
      ],
      "<html></html>",
      { groqClient },
    );

    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.violationId)).toEqual(["v1", "v2"]);
    expect(suggestions[0]?.diffBefore).toBe("<img>");
    expect(suggestions[1]?.diffAfter).toBe("<h1></h1><h2></h2>");
  });

  it("envia ao Groq o prompt versionado de fix-generation.md", async () => {
    const groqClient: GroqClient = {
      chatCompletion: vi.fn(async () => ({
        content: JSON.stringify({
          diffBefore: "<img>",
          diffAfter: '<img alt="x">',
          explanation: "x",
        }),
      })),
    };

    await generateFixSuggestions([sampleViolation()], "<html></html>", {
      groqClient,
    });

    expect(groqClient.chatCompletion).toHaveBeenCalledOnce();
    const call = vi.mocked(groqClient.chatCompletion).mock.calls[0]?.[0];
    expect(call?.model).toBe("openai/gpt-oss-120b");
    const userContent = call?.messages.find((m) => m.role === "user")?.content;
    expect(userContent).toContain("FixSuggestion");
    expect(userContent).toContain("diffBefore");
    expect(userContent).toContain("Imagem sem texto alternativo");
    expect(userContent).toContain('<img src="produto.jpg">');
  });
});
