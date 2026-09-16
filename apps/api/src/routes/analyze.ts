import type { FastifyInstance } from "fastify";
import type { AnalysisRun, Page } from "@mavi/shared";
import {
  CaptureError,
  type CaptureFailureReason,
  capturePage,
} from "../capture/capturePage.ts";
import type { AnalysisStore } from "../db/analysisStore.ts";

interface AnalyzeBody {
  url?: string;
}

interface AnalyzeSuccess {
  page: Page;
  analysisRun: AnalysisRun;
}

interface AnalyzeFailure {
  error: {
    reason: CaptureFailureReason;
    message: string;
    statusCode?: number;
  };
}

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

export function registerAnalyzeRoute(
  app: FastifyInstance,
  options: { store: AnalysisStore; screenshotDir: string },
): void {
  app.post<{ Body: AnalyzeBody }>("/analyze", async (request, reply) => {
    const url = request.body?.url?.trim();
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
        modelVersions: {},
      });

      const body: AnalyzeSuccess = { page, analysisRun };
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
