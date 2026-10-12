import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Caminho versionado relativo à raiz do monorepo (não hardcoded na lógica de análise). */
export const VISION_PROMPT_RELATIVE_PATH = "prompts/vision-analysis.md";

function defaultPromptPath(): string {
  // apps/api/src/analysis/vision → raiz do monorepo
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../../", VISION_PROMPT_RELATIVE_PATH);
}

export async function loadVisionPrompt(
  promptPath: string = defaultPromptPath(),
): Promise<string> {
  const content = await readFile(promptPath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error(`Prompt de visão vazio: ${promptPath}`);
  }
  return trimmed;
}
