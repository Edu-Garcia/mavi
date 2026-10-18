import Fastify, { LogController, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { AnalysisLayer } from "@mavi/shared";
import type { AnalysisStore } from "./db/analysisStore.ts";
import type { FixSuggestionStore } from "./db/fixSuggestionStore.ts";
import {
  registerAnalyzeRoute,
  type GenerateFixesFn,
} from "./routes/analyze.ts";
import { registerFixturesRoute } from "./routes/fixtures.ts";
import { registerPageScreenshotRoute } from "./routes/pageScreenshot.ts";

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
  axeHtmlDir?: string;
  axeLayer?: AnalysisLayer;
  visionLayer?: AnalysisLayer;
  generateFixes?: GenerateFixesFn;
  fixSuggestionStore?: FixSuggestionStore;
  env?: NodeJS.ProcessEnv;
  logger?: boolean;
  serveFixtures?: boolean;
  repoRoot?: string;
}

function shouldEnableLogger(options: AppOptions): boolean {
  if (options.logger !== undefined) {
    return options.logger;
  }
  return process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: shouldEnableLogger(options) ? { level: "error" } : false,
    logController: new LogController({ disableRequestLogging: true }),
  });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok", service: "mavi-api" }));
  registerAnalyzeRoute(app, options);
  registerPageScreenshotRoute(app, {
    store: options.store,
    axeHtmlDir: options.axeHtmlDir,
  });
  registerFixturesRoute(app, {
    enabled: options.serveFixtures !== false,
    repoRoot: options.repoRoot,
  });

  return app;
}
