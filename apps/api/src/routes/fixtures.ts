import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { findRepoRoot } from "../env/loadEnv.ts";

const FIXTURE_KINDS = {
  validation: path.join("validation", "pages"),
  benchmark: path.join("benchmark", "pages"),
} as const;

type FixtureKind = keyof typeof FIXTURE_KINDS;

const FILE_NAME = /^[A-Za-z0-9._-]+\.html$/;

export function registerFixturesRoute(
  app: FastifyInstance,
  options?: { repoRoot?: string; enabled?: boolean },
): void {
  if (options?.enabled === false) {
    return;
  }

  const repoRoot = options?.repoRoot ?? findRepoRoot();

  app.get<{ Params: { kind: string; file: string } }>(
    "/fixtures/:kind/:file",
    async (request, reply) => {
      const kind = request.params.kind;
      const file = request.params.file;
      if (!(kind in FIXTURE_KINDS)) {
        return reply.status(404).send({ error: { message: "Fixture não encontrada" } });
      }
      if (!FILE_NAME.test(file)) {
        return reply.status(400).send({ error: { message: "Nome de fixture inválido" } });
      }

      const relativeDir = FIXTURE_KINDS[kind as FixtureKind];
      const dir = path.resolve(repoRoot, relativeDir);
      const fullPath = path.resolve(dir, file);
      if (!fullPath.startsWith(dir + path.sep) && fullPath !== dir) {
        return reply.status(400).send({ error: { message: "Nome de fixture inválido" } });
      }

      try {
        const html = await readFile(fullPath, "utf8");
        return reply.type("text/html; charset=utf-8").send(html);
      } catch {
        return reply.status(404).send({ error: { message: "Fixture não encontrada" } });
      }
    },
  );
}
