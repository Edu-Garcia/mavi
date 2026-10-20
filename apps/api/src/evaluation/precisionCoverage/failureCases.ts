import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { createAnalysisStore } from "../../db/analysisStore.ts";
import { findRepoRoot } from "../../env/loadEnv.ts";
import { buildApp } from "../../server.ts";
import { scoreByConfiguration } from "./scoreByConfiguration.ts";
import type { FailureCaseRecord } from "./types.ts";

const repoRoot = findRepoRoot(
  path.dirname(fileURLToPath(import.meta.url)),
);

const PAGES = {
  "01-controle": path.join(repoRoot, "validation/pages/01-controle.html"),
  "02-somente-visuais": path.join(
    repoRoot,
    "validation/pages/02-somente-visuais.html",
  ),
  "03-somente-estruturais": path.join(
    repoRoot,
    "validation/pages/03-somente-estruturais.html",
  ),
  "missing-alt": path.join(repoRoot, "benchmark/pages/missing-alt.html"),
  "dynamic-contrast": path.join(
    repoRoot,
    "benchmark/pages/dynamic-contrast.html",
  ),
};

interface AnalyzeBody {
  violations: Array<{ sourceLayer: string; wcagCriterion: string }>;
  diagnostics: {
    vision: {
      attempted: boolean;
      skippedReason?: string;
      error?: string;
      violationCount: number;
    };
    groq: {
      attempted: boolean;
      skippedReason?: string;
      error?: string;
      suggestionCount: number;
    };
  };
  fixSuggestions: unknown[];
}

async function analyze(
  app: FastifyInstance,
  pagePath: string,
  mode: "audit" | "fix" = "audit",
): Promise<{ status: number; body: AnalyzeBody }> {
  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: { url: pagePath, mode },
  });
  return {
    status: response.statusCode,
    body: response.json() as AnalyzeBody,
  };
}

function hasStructural(
  body: AnalyzeBody,
  number: string,
): boolean {
  return body.violations.some(
    (item) =>
      (item.sourceLayer === "axe" || item.sourceLayer === "both") &&
      item.wcagCriterion.startsWith(number),
  );
}

export async function runFailureCases(options: {
  dataDir: string;
}): Promise<FailureCaseRecord[]> {
  await mkdir(options.dataDir, { recursive: true });
  const screenshotDir = path.join(options.dataDir, "screenshots");
  const axeHtmlDir = path.join(options.dataDir, "axe-html");
  const records: FailureCaseRecord[] = [];

  const missingKeyStore = await createAnalysisStore(
    path.join(options.dataDir, "missing-key.sqlite"),
  );
  const missingKeyApp = await buildApp({
    store: missingKeyStore,
    screenshotDir,
    axeHtmlDir,
    env: { GEMINI_API_KEY: "", GROQ_API_KEY: "" },
    logger: false,
  });

  try {
    const structuralPages = ["01-controle", "03-somente-estruturais", "missing-alt"] as const;
    const visualPages = ["02-somente-visuais", "dynamic-contrast"] as const;

    const structuralResults = [];
    for (const id of structuralPages) {
      structuralResults.push(await analyze(missingKeyApp, PAGES[id]));
    }
    const visualResults = [];
    for (const id of visualPages) {
      visualResults.push(await analyze(missingKeyApp, PAGES[id]));
    }

    const structuralOk = structuralResults.every((result) => result.status === 200);
    const missingAltHasAlt = hasStructural(
      structuralResults[2]!.body,
      "1.1.1",
    );
    const page03HasAlt = hasStructural(structuralResults[1]!.body, "1.1.1");
    const visualWarned = visualResults.every(
      (result) =>
        result.status === 200 &&
        result.body.diagnostics.vision.skippedReason === "missing_key" &&
        !result.body.violations.some((item) => item.sourceLayer === "vision"),
    );

    records.push({
      id: "missing-gemini-key",
      pages: [...structuralPages, ...visualPages],
      passed:
        structuralOk && missingAltHasAlt && page03HasAlt && visualWarned,
      expected:
        "Estrutural sai normal em 01, 03 e missing-alt; visual vazio com aviso em 02 e dynamic-contrast; nada quebra",
      found: [
        `status estrutural: ${structuralResults.map((item) => item.status).join(",")}`,
        `missing-alt 1.1.1: ${missingAltHasAlt}`,
        `03 1.1.1: ${page03HasAlt}`,
        `aviso visual: ${visualWarned}`,
      ].join("; "),
    });
  } finally {
    await missingKeyApp.close();
    missingKeyStore.close();
  }

  const gemini503Store = await createAnalysisStore(
    path.join(options.dataDir, "gemini-503.sqlite"),
  );
  const gemini503App = await buildApp({
    store: gemini503Store,
    screenshotDir,
    axeHtmlDir,
    visionLayer: {
      analyze: async () => {
        throw new Error("Gemini 503 — alta demanda, tente de novo");
      },
    },
    generateFixes: async () => [],
    logger: false,
  });

  try {
    const pageIds = [
      "01-controle",
      "02-somente-visuais",
      "03-somente-estruturais",
      "missing-alt",
      "dynamic-contrast",
    ] as const;
    const results = [];
    for (const id of pageIds) {
      results.push(await analyze(gemini503App, PAGES[id]));
    }
    const allOk = results.every((result) => result.status === 200);
    const visionFailed = results.every(
      (result) =>
        result.body.diagnostics.vision.attempted &&
        result.body.diagnostics.vision.error?.includes("503"),
    );
    const visualEmpty = results.every(
      (result) =>
        !result.body.violations.some((item) => item.sourceLayer === "vision"),
    );
    const missingAltOk = hasStructural(results[3]!.body, "1.1.1");

    records.push({
      id: "gemini-503",
      pages: [...pageIds],
      passed: allOk && visionFailed && visualEmpty && missingAltOk,
      expected:
        "Mesmo comportamento de chave ausente: estrutural segue, visual vazio com aviso, sem crash",
      found: [
        `status: ${results.map((item) => item.status).join(",")}`,
        `erro 503: ${visionFailed}`,
        `visual vazia: ${visualEmpty}`,
        `missing-alt 1.1.1: ${missingAltOk}`,
      ].join("; "),
    });

    const incomplete = scoreIncompleteVisualRound(
      results[4]!.body.violations.map((item) => ({
        id: "x",
        analysisRunId: "r",
        wcagCriterion: item.wcagCriterion,
        sourceLayer: item.sourceLayer as "axe" | "vision" | "both",
        description: "",
        htmlSnippet: "",
        severity: "moderate" as const,
      })),
      results[4]!.body.diagnostics.vision,
    );
    records.push({
      id: "benchmark-incomplete-not-zero-visual",
      pages: ["dynamic-contrast"],
      passed: incomplete.status === "incomplete",
      expected:
        "Rodada incompleta quando a visão falha; não conta a camada visual como 0 achados corretos",
      found: `${incomplete.status}: ${incomplete.reason ?? "scoreada"}`,
    });
  } finally {
    await gemini503App.close();
    gemini503Store.close();
  }

  const groqStore = await createAnalysisStore(
    path.join(options.dataDir, "missing-groq.sqlite"),
  );
  const groqApp = await buildApp({
    store: groqStore,
    screenshotDir,
    axeHtmlDir,
    env: { GEMINI_API_KEY: "", GROQ_API_KEY: "" },
    visionLayer: { analyze: async () => [] },
    logger: false,
  });

  try {
    const result = await analyze(groqApp, PAGES["03-somente-estruturais"], "fix");
    const warned =
      result.body.diagnostics.groq.skippedReason === "missing_key" &&
      result.status === 200 &&
      result.body.fixSuggestions.length === 0 &&
      hasStructural(result.body, "1.1.1");
    records.push({
      id: "missing-groq-key-on-03",
      pages: ["03-somente-estruturais"],
      passed: warned,
      expected:
        "Análise completa sem sugestão; falta de Groq avisada, sem erro",
      found: [
        `status ${result.status}`,
        `skipped=${result.body.diagnostics.groq.skippedReason}`,
        `suggestions=${result.body.fixSuggestions.length}`,
        `1.1.1=${hasStructural(result.body, "1.1.1")}`,
      ].join("; "),
    });
  } finally {
    await groqApp.close();
    groqStore.close();
  }

  return records;
}

export function scoreIncompleteVisualRound(
  violations: Parameters<typeof scoreByConfiguration>[0],
  vision: { skippedReason?: string; error?: string; attempted: boolean },
): { status: "completed" | "incomplete"; reason?: string } {
  if (vision.skippedReason === "missing_key" || vision.error) {
    return {
      status: "incomplete",
      reason: vision.error ?? vision.skippedReason ?? "vision_unavailable",
    };
  }
  void violations;
  return { status: "completed" };
}
