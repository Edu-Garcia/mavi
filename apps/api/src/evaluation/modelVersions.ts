import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ModelVersions } from "@mavi/shared";
import { axeCoreVersion } from "../analysis/axe/axeCoreVersion.ts";
import {
  defaultVisionPromptPath,
  VISION_PROMPT_RELATIVE_PATH,
} from "../analysis/vision/loadVisionPrompt.ts";
import { geminiModelVersion } from "../clients/gemini.ts";
import { LLAMA_3_3_70B_MODEL } from "../clients/groq.ts";
import {
  defaultFixPromptPath,
  FIX_PROMPT_RELATIVE_PATH,
} from "../fix-generation/loadFixPrompt.ts";

export function promptVersionId(
  relativePath: string,
  absolutePath: string,
): string {
  const hash = createHash("sha256")
    .update(readFileSync(absolutePath))
    .digest("hex")
    .slice(0, 12);
  return `${relativePath}#${hash}`;
}

/** Versões de modelo e de prompt gravadas em cada AnalysisRun. */
export function buildModelVersions(
  env: NodeJS.ProcessEnv = process.env,
  options?: { includeLlama?: boolean },
): ModelVersions {
  const versions: ModelVersions = {
    axeCore: axeCoreVersion(),
    visionPrompt: promptVersionId(
      VISION_PROMPT_RELATIVE_PATH,
      defaultVisionPromptPath(),
    ),
    fixPrompt: promptVersionId(
      FIX_PROMPT_RELATIVE_PATH,
      defaultFixPromptPath(),
    ),
  };

  if (env.GEMINI_API_KEY?.trim()) {
    versions.gemini = geminiModelVersion();
  }
  if (options?.includeLlama !== false && env.GROQ_API_KEY?.trim()) {
    versions.llama = LLAMA_3_3_70B_MODEL;
  }

  return versions;
}
