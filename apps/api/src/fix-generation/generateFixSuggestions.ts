import { randomUUID } from "node:crypto";
import type { FixSuggestion, Violation } from "@mavi/shared";
import { groqChatModel, type GroqClient } from "../clients/groq.ts";
import { loadFixPrompt } from "./loadFixPrompt.ts";

export interface GenerateFixSuggestionsOptions {
  groqClient: GroqClient;
  promptPath?: string;
  now?: () => Date;
  idFactory?: () => string;
}

interface ParsedFixPayload {
  diffBefore: string;
  diffAfter: string;
  explanation: string;
}

function fillPrompt(
  template: string,
  violation: Violation,
  pageHtml: string,
): string {
  return template
    .replaceAll("{{wcagCriterion}}", violation.wcagCriterion)
    .replaceAll("{{description}}", violation.description)
    .replaceAll("{{severity}}", violation.severity)
    .replaceAll("{{htmlSnippet}}", violation.htmlSnippet)
    .replaceAll("{{pageHtml}}", pageHtml);
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function parseFixPayload(content: string): ParsedFixPayload {
  const parsed = JSON.parse(extractJsonObject(content)) as Partial<ParsedFixPayload>;
  if (
    typeof parsed.diffBefore !== "string" ||
    typeof parsed.diffAfter !== "string" ||
    typeof parsed.explanation !== "string"
  ) {
    throw new Error(
      "Groq fix response must include diffBefore, diffAfter, and explanation strings",
    );
  }
  return {
    diffBefore: parsed.diffBefore,
    diffAfter: parsed.diffAfter,
    explanation: parsed.explanation,
  };
}

export async function generateFixSuggestions(
  violations: Violation[],
  pageHtml: string,
  options: GenerateFixSuggestionsOptions,
): Promise<FixSuggestion[]> {
  const promptTemplate = await loadFixPrompt(options.promptPath);
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());
  const suggestions: FixSuggestion[] = [];

  for (const violation of violations) {
    const prompt = fillPrompt(promptTemplate, violation, pageHtml);
    const result = await options.groqClient.chatCompletion({
      model: groqChatModel(),
      messages: [{ role: "user", content: prompt }],
    });
    const payload = parseFixPayload(result.content);
    suggestions.push({
      id: idFactory(),
      violationId: violation.id,
      diffBefore: payload.diffBefore,
      diffAfter: payload.diffAfter,
      explanation: payload.explanation,
      generatedAt: now(),
    });
  }

  return suggestions;
}
