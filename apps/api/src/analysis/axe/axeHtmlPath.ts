import path from "node:path";

export function axeAnalyzedHtmlPath(htmlDir: string, pageId: string): string {
  return path.join(htmlDir, `axe-${pageId}.html`);
}
