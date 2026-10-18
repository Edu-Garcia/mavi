import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type {
  AnalysisLayer,
  AnalyzeDiagnostics,
  AnalysisRun,
  FixSuggestion,
  GroqDiagnostic,
  Page,
  Violation,
  VisionDiagnostic,
} from "@mavi/shared";
import {
  CaptureError,
  type CaptureFailureReason,
  capturePage,
} from "../capture/capturePage.ts";
import type { AnalysisStore } from "../db/analysisStore.ts";
import type { FixSuggestionStore } from "../db/fixSuggestionStore.ts";
import { createAxeAnalysisLayer } from "../analysis/axe/axeAnalysisLayer.ts";
import { mergeViolations } from "../analysis/merge/mergeViolations.ts";
import { createDefaultVisionLayer } from "../analysis/vision/index.ts";
import { createGroqClient, type GroqClient } from "../clients/groq.ts";
import { apiKeysPresent } from "../env/loadEnv.ts";
import { buildModelVersions } from "../evaluation/modelVersions.ts";
import { generateFixSuggestions } from "../fix-generation/index.ts";
import { OptionalLayerSkip } from "../observability/optionalLayerSkip.ts";
import {
  createPipelineTracker,
  errorMessage,
} from "../observability/pipelineTracker.ts";

export type AnalyzeMode = "audit" | "fix";

interface AnalyzeBody {
  url?: string;
  mode?: AnalyzeMode;
}

function resolveAnalyzeMode(mode: unknown): AnalyzeMode {
  return mode === "audit" ? "audit" : "fix";
}

interface AnalyzeSuccess {
  page: Page;
  analysisRun: AnalysisRun;
  violations: Violation[];
  fixSuggestions: FixSuggestion[];
  diagnostics: AnalyzeDiagnostics;
}

interface AnalyzeFailure {
  error: {
    reason: CaptureFailureReason;
    message: string;
    statusCode?: number;
  };
}

export type GenerateFixesFn = (
  violations: Violation[],
  pageHtml: string,
) => Promise<FixSuggestion[]>;

function httpStatusForCaptureReason(reason: CaptureFailureReason): number {
  switch (reason) {
    case "invalid_url":
      return 400;
    case "timeout":
      return 504;
    case "http_error":
    case "navigation_failed":
      return 502;
  }
}

function defaultGenerateFixes(env: NodeJS.ProcessEnv): GenerateFixesFn {
  const apiKey = env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return async () => {
      throw new OptionalLayerSkip("groq", "missing_key");
    };
  }
  const groqClient: GroqClient = createGroqClient({ apiKey });
  return (violations, pageHtml) =>
    generateFixSuggestions(violations, pageHtml, { groqClient });
}

export function registerAnalyzeRoute(
  app: FastifyInstance,
  options: {
    store: AnalysisStore;
    screenshotDir: string;
    axeHtmlDir?: string;
    axeLayer?: AnalysisLayer;
    visionLayer?: AnalysisLayer;
    generateFixes?: GenerateFixesFn;
    fixSuggestionStore?: FixSuggestionStore;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const env = options.env ?? process.env;
  const axeLayer =
    options.axeLayer ??
    createAxeAnalysisLayer({ htmlDir: options.axeHtmlDir });
  const visionLayer =
    options.visionLayer ?? createDefaultVisionLayer({ env });
  const generateFixes = options.generateFixes ?? defaultGenerateFixes(env);

  app.post<{ Body: AnalyzeBody }>("/analyze", async (request, reply) => {
    const url = request.body?.url?.trim();
    const mode = resolveAnalyzeMode(request.body?.mode);
    if (!url) {
      const body: AnalyzeFailure = {
        error: {
          reason: "invalid_url",
          message: "Campo url é obrigatório",
        },
      };
      return reply.status(400).send(body);
    }

    const pipelineId = randomUUID();
    const pipelineStarted = Date.now();
    const tracker = createPipelineTracker({
      runId: pipelineId,
      url,
      mode,
    });
    tracker.record("start", "ok", 0);

    try {
      const captureStarted = Date.now();
      let capture;
      try {
        capture = await capturePage(url, {
          screenshotDir: options.screenshotDir,
        });
        tracker.record("capture", "ok", Date.now() - captureStarted);
      } catch (error) {
        tracker.record("capture", "error", Date.now() - captureStarted);
        throw error;
      }

      const page = options.store.savePage({
        url: capture.url,
        capturedHtml: capture.html,
        screenshotPath: capture.screenshotPath,
      });

      const analysisRun = options.store.saveAnalysisRun({
        pageId: page.id,
        status: "completed",
        modelVersions: buildModelVersions(env),
      });

      const axeStarted = Date.now();
      let axeViolations: Violation[];
      try {
        axeViolations = await axeLayer.analyze(page, analysisRun);
        tracker.record("axe", "ok", Date.now() - axeStarted, {
          violationCount: axeViolations.length,
        });
      } catch (error) {
        tracker.record("axe", "error", Date.now() - axeStarted);
        throw error;
      }

      const vision: VisionDiagnostic = {
        attempted: false,
        violationCount: 0,
      };
      const visionStarted = Date.now();
      let visionViolations: Violation[] = [];
      try {
        visionViolations = await visionLayer.analyze(page, analysisRun);
        vision.attempted = true;
        vision.violationCount = visionViolations.length;
        tracker.record("vision", "ok", Date.now() - visionStarted, {
          violationCount: visionViolations.length,
        });
      } catch (error) {
        if (error instanceof OptionalLayerSkip) {
          vision.skippedReason = "missing_key";
          tracker.record("vision", "skipped", Date.now() - visionStarted, {
            skippedReason: "missing_key",
          });
        } else {
          vision.attempted = true;
          vision.error = errorMessage(error);
          tracker.record("vision", "error", Date.now() - visionStarted, {
            error: vision.error,
          });
        }
        visionViolations = [];
      }

      const mergeStarted = Date.now();
      const violations = options.store.saveViolations(
        mergeViolations(axeViolations, visionViolations),
      );
      tracker.record("merge", "ok", Date.now() - mergeStarted, {
        violationCount: violations.length,
      });

      const groq: GroqDiagnostic = {
        attempted: false,
        suggestionCount: 0,
      };
      let fixSuggestions: FixSuggestion[] = [];
      const groqStarted = Date.now();
      if (mode === "audit") {
        groq.skippedReason = "audit_mode";
        tracker.record("groq", "skipped", Date.now() - groqStarted, {
          skippedReason: "audit_mode",
        });
      } else {
        try {
          fixSuggestions = await generateFixes(violations, page.capturedHtml);
          groq.attempted = true;
          groq.suggestionCount = fixSuggestions.length;
          tracker.record("groq", "ok", Date.now() - groqStarted, {
            suggestionCount: fixSuggestions.length,
          });

          if (options.fixSuggestionStore) {
            for (const suggestion of fixSuggestions) {
              options.fixSuggestionStore.save(suggestion);
            }
          }
        } catch (error) {
          if (error instanceof OptionalLayerSkip) {
            groq.skippedReason =
              error.skippedReason === "audit_mode"
                ? "audit_mode"
                : "missing_key";
            tracker.record("groq", "skipped", Date.now() - groqStarted, {
              skippedReason: groq.skippedReason,
            });
          } else {
            groq.attempted = true;
            groq.error = errorMessage(error);
            tracker.record("groq", "error", Date.now() - groqStarted, {
              error: groq.error,
            });
          }
        }
      }

      tracker.record("done", "ok", Date.now() - pipelineStarted);

      const diagnostics: AnalyzeDiagnostics = {
        stages: tracker.stages,
        vision,
        groq,
        keys: apiKeysPresent(env),
      };

      const body: AnalyzeSuccess = {
        page,
        analysisRun,
        violations,
        fixSuggestions,
        diagnostics,
      };
      return reply.status(200).send(body);
    } catch (error) {
      if (error instanceof CaptureError) {
        const body: AnalyzeFailure = {
          error: {
            reason: error.reason,
            message: error.message,
            statusCode: error.statusCode,
          },
        };
        return reply
          .status(httpStatusForCaptureReason(error.reason))
          .send(body);
      }

      throw error;
    }
  });
}
