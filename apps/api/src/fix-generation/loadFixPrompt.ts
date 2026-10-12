import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../prompts/fix-generation.md",
);

export async function loadFixPrompt(
  promptPath: string = DEFAULT_PROMPT_PATH,
): Promise<string> {
  return readFile(promptPath, "utf8");
}

export function defaultFixPromptPath(): string {
  return DEFAULT_PROMPT_PATH;
}
