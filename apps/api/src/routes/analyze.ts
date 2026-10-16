import type { FastifyInstance } from "fastify";
import type {
  AnalysisLayer,
  AnalysisRun,
  FixSuggestion,
  Page,
  Violation,
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
import { buildModelVersions } from "../evaluation/modelVersions.ts";
import { generateFixSuggestions } from "../fix-generation/index.ts";

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

function defaultGenerateFixes(): GenerateFixesFn {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return async () => [];
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
    axeLayer?: AnalysisLayer;
    visionLayer?: AnalysisLayer;
    generateFixes?: GenerateFixesFn;
    fixSuggestionStore?: FixSuggestionStore;
  },
): void {
  const axeLayer = options.axeLayer ?? createAxeAnalysisLayer();
  const visionLayer = options.visionLayer ?? createDefaultVisionLayer();
  const generateFixes = options.generateFixes ?? defaultGenerateFixes();

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

    try {
      const capture = await capturePage(url, {
        screenshotDir: options.screenshotDir,
      });

      const page = options.store.savePage({
        url: capture.url,
        capturedHtml: capture.html,
        screenshotPath: capture.screenshotPath,
      });

      const analysisRun = options.store.saveAnalysisRun({
        pageId: page.id,
        status: "completed",
        modelVersions: buildModelVersions(),
      });

      const axeViolations = await axeLayer.analyze(page, analysisRun);

      let visionViolations: Violation[] = [];
      try {
        visionViolations = await visionLayer.analyze(page, analysisRun);
      } catch {
        // Camada visual opcional: falha de Gemini não invalida o resultado axe.
        visionViolations = [];
      }

      const violations = options.store.saveViolations(
        mergeViolations(axeViolations, visionViolations),
      );

      let fixSuggestions: FixSuggestion[] = [];
      if (mode !== "audit") {
        try {
          fixSuggestions = await generateFixes(violations, page.capturedHtml);
        } catch {
          // Correções opcionais: falha de Groq não invalida violações já detectadas.
          fixSuggestions = [];
        }

        if (options.fixSuggestionStore) {
          for (const suggestion of fixSuggestions) {
            options.fixSuggestionStore.save(suggestion);
          }
        }
      }

      const body: AnalyzeSuccess = {
        page,
        analysisRun,
        violations,
        fixSuggestions,
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
