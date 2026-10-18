import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { axeAnalyzedHtmlPath } from "../analysis/axe/axeHtmlPath.ts";
import type { AnalysisStore } from "../db/analysisStore.ts";

export function registerPageScreenshotRoute(
  app: FastifyInstance,
  options: { store: AnalysisStore; axeHtmlDir?: string },
): void {
  app.get<{ Params: { pageId: string } }>(
    "/pages/:pageId/screenshot",
    async (request, reply) => {
      const page = options.store.getPage(request.params.pageId);
      if (!page) {
        return reply.status(404).send({ error: { message: "Page não encontrada" } });
      }

      try {
        const bytes = await readFile(page.screenshotPath);
        return reply.type("image/png").send(bytes);
      } catch {
        return reply
          .status(404)
          .send({ error: { message: "Screenshot não encontrado" } });
      }
    },
  );

  if (!options.axeHtmlDir) {
    return;
  }

  const axeHtmlDir = options.axeHtmlDir;
  app.get<{ Params: { pageId: string } }>(
    "/pages/:pageId/axe-html",
    async (request, reply) => {
      const page = options.store.getPage(request.params.pageId);
      if (!page) {
        return reply.status(404).send({ error: { message: "Page não encontrada" } });
      }

      try {
        const html = await readFile(
          axeAnalyzedHtmlPath(axeHtmlDir, page.id),
          "utf8",
        );
        return reply.type("text/html; charset=utf-8").send(html);
      } catch {
        return reply
          .status(404)
          .send({ error: { message: "HTML analisado pelo axe não encontrado" } });
      }
    },
  );
}
