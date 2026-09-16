import Fastify, { type FastifyInstance } from "fastify";
import type { AnalysisStore } from "./db/analysisStore.ts";
import { registerAnalyzeRoute } from "./routes/analyze.ts";

export type {
  AnalysisLayer,
  AnalysisRun,
  BenchmarkCase,
  EvaluationResult,
  FixSuggestion,
  Page,
  Violation,
} from "@mavi/shared";

export interface AppOptions {
  store: AnalysisStore;
  screenshotDir: string;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok", service: "mavi-api" }));
  registerAnalyzeRoute(app, options);

  return app;
}
