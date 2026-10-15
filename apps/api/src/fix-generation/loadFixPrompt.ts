import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIX_PROMPT_RELATIVE_PATH = "prompts/fix-generation.md";

const DEFAULT_PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  FIX_PROMPT_RELATIVE_PATH,
);

export async function loadFixPrompt(
  promptPath: string = DEFAULT_PROMPT_PATH,
): Promise<string> {
  return readFile(promptPath, "utf8");
}

export function defaultFixPromptPath(): string {
  return DEFAULT_PROMPT_PATH;
}
