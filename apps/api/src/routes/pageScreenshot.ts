import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import type { AnalysisStore } from "../db/analysisStore.ts";

export function registerPageScreenshotRoute(
  app: FastifyInstance,
  options: { store: AnalysisStore },
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
}
