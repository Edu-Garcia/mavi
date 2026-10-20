import { createRequire } from "node:module";
import { chromium } from "playwright";
import { axeCoreVersion } from "../../analysis/axe/axeCoreVersion.ts";
import {
  defaultVisionPromptPath,
  VISION_PROMPT_RELATIVE_PATH,
} from "../../analysis/vision/loadVisionPrompt.ts";
import { CAPTURE_VIEWPORT } from "../../capture/viewport.ts";
import { geminiModelVersion } from "../../clients/gemini.ts";
import { groqChatModel } from "../../clients/groq.ts";
import { promptVersionId } from "../modelVersions.ts";
import type { AmbienteJson } from "./types.ts";

const require = createRequire(import.meta.url);

function packageVersion(name: string): string {
  try {
    const pkg = require(`${name}/package.json`) as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

export async function collectEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AmbienteJson> {
  const browser = await chromium.launch({ headless: true });
  try {
    const version = browser.version();
    const visionPrompt = promptVersionId(
      VISION_PROMPT_RELATIVE_PATH,
      defaultVisionPromptPath(),
    );
    const hash = visionPrompt.split("#")[1] ?? "";
    return {
      collectedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      playwright: packageVersion("playwright"),
      playwrightBrowser: {
        name: "chromium",
        version,
      },
      axeCore: axeCoreVersion(),
      captureViewport: { ...CAPTURE_VIEWPORT },
      models: {
        gemini: geminiModelVersion(),
        groq: groqChatModel(env),
      },
      prompts: {
        vision: visionPrompt,
        visionHash: hash,
      },
    };
  } finally {
    await browser.close();
  }
}
