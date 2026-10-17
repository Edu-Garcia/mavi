import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultFixPromptPath } from "../../src/fix-generation/loadFixPrompt.ts";
import { defaultVisionPromptPath } from "../../src/analysis/vision/loadVisionPrompt.ts";
import {
  buildModelVersions,
  promptVersionId,
} from "../../src/evaluation/modelVersions.ts";

describe("promptVersionId", () => {
  let dataDir = "";

  afterEach(() => {
    if (dataDir) {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("identifica o prompt pelo caminho e pelos 12 primeiros hex do sha256", () => {
    dataDir = mkdtempSync(path.join(tmpdir(), "mavi-prompt-"));
    const filePath = path.join(dataDir, "vision-analysis.md");
    writeFileSync(filePath, "hello");

    expect(promptVersionId("prompts/vision-analysis.md", filePath)).toBe(
      "prompts/vision-analysis.md#2cf24dba5fb0",
    );
  });
});

describe("buildModelVersions", () => {
  it("registra axe-core e a versão dos prompts de visão e correção", () => {
    const versions = buildModelVersions();
    const visionHash = createHash("sha256")
      .update(readFileSync(defaultVisionPromptPath()))
      .digest("hex")
      .slice(0, 12);
    const fixHash = createHash("sha256")
      .update(readFileSync(defaultFixPromptPath()))
      .digest("hex")
      .slice(0, 12);

    expect(versions.axeCore).toBeTruthy();
    expect(versions.visionPrompt).toBe(
      `prompts/vision-analysis.md#${visionHash}`,
    );
    expect(versions.fixPrompt).toBe(`prompts/fix-generation.md#${fixHash}`);
  });

  it("omite o Llama quando a rodada não usa correção", () => {
    const versions = buildModelVersions(
      { GEMINI_API_KEY: "test-gemini", GROQ_API_KEY: "test-groq" },
      { includeLlama: false },
    );

    expect(versions.gemini).toBe("gemini-3.8-flash");
    expect(versions.llama).toBeUndefined();
  });
});
