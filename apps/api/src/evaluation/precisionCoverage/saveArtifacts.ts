import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@mavi/shared";

export interface ArtifactContext {
  dir: string;
}

export async function ensureArtifactDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function saveCapturedPage(
  dir: string,
  page: Pick<Page, "capturedHtml" | "screenshotPath">,
): Promise<void> {
  await ensureArtifactDir(dir);
  await writeFile(path.join(dir, "captured.html"), page.capturedHtml, "utf8");
  try {
    await copyFile(page.screenshotPath, path.join(dir, "screenshot.png"));
  } catch (error) {
    await writeFile(
      path.join(dir, "screenshot-copy-error.txt"),
      error instanceof Error ? error.message : String(error),
      "utf8",
    );
  }
}

export function bindArtifactWriters(ctx: ArtifactContext) {
  return {
    onRawAxe: async (_page: Page, results: unknown) => {
      if (!ctx.dir) {
        return;
      }
      await writeJson(path.join(ctx.dir, "axe-raw.json"), results);
    },
    onRawGemini: async (_page: Page, raw: string) => {
      if (!ctx.dir) {
        return;
      }
      await ensureArtifactDir(ctx.dir);
      await writeFile(path.join(ctx.dir, "gemini-raw.txt"), raw, "utf8");
    },
  };
}
