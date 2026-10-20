import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page as CapturedPage } from "@mavi/shared";
import { chromium } from "playwright";
import { createAxeAnalysisLayer } from "../../analysis/axe/axeAnalysisLayer.ts";
import { createVisionAnalysisLayer } from "../../analysis/vision/visionAnalysisLayer.ts";
import { createDefaultVisionLayer } from "../../analysis/vision/createDefaultVisionLayer.ts";
import { CAPTURE_VIEWPORT } from "../../capture/viewport.ts";
import { createGeminiClient } from "../../clients/gemini.ts";
import {
  createGeminiRateLimiter,
  GEMINI_FLASH_LITE_RPD,
  GEMINI_FLASH_LITE_RPM,
  withGeminiRateLimit,
} from "./geminiRateLimit.ts";
import {
  destVisionAlreadyComplete,
  hydrateReplayedRound,
  listReusableJobs,
  replayRound,
} from "./reuseScreenshots.ts";
import { findRepoRoot } from "../../env/loadEnv.ts";
import { assertValidationPage } from "./assertValidation.ts";
import { collectEnvironment } from "./collectEnvironment.ts";
import {
  axeHtmlContainsSelector,
  exportMatchesLists,
  launchDashboardPage,
  runDashboardAnalysis,
  VALIDATION_SHORTCUTS,
} from "./dashboardDriver.ts";
import { runFailureCases } from "./failureCases.ts";
import { runBenchmarkCampaign } from "./runBenchmarkCampaign.ts";
import {
  bindArtifactWriters,
  saveCapturedPage,
  type ArtifactContext,
} from "./saveArtifacts.ts";
import { splitViolationsBySource } from "./splitBySource.ts";
import { startCampaignServers } from "./startServers.ts";
import type {
  AnalyzeMode,
  FailureCaseRecord,
  PrecisionCoverageSummary,
  ValidationPageId,
  ValidationRoundRecord,
} from "./types.ts";
import { VALIDATION_PAGE_IDS } from "./types.ts";
import { loadResume } from "./loadResume.ts";
import {
  isQuotaVisionError,
  retryVisionCall,
  VISION_RETRY_ATTEMPTS,
  VISION_RETRY_DELAY_MS,
} from "./visionRetry.ts";
import { writeCampaignReport } from "./writeReport.ts";

const CHOICES = [
  "sourceLayer no código continua `axe` | `vision` | `both`; o relatório traduz para estrutural / visual / MAVI completo.",
  "Atalhos das 4 páginas de validação já existiam no dashboard; não foram criados os 4 botões que faltam do benchmark (missing-lang, heading-order, empty-link, inadequate-touch-targets). Essas páginas entram pelo CLI de benchmark e, no caso do HTML do axe de missing-alt, pela URL de fixture.",
  "Janela Playwright explicitada em 1280×720 (era o padrão implícito) na captura e no e2e.",
  "Merge passou a comparar o critério WCAG pelo número (`1.4.3`), como o plano pede; a região continua pelo snippet.",
  "Listas do dashboard e do HTML exportado sempre mostram as duas seções, mesmo sem violações.",
  "O benchmark das 5 rodadas usa o mesmo pipeline do `npm run benchmark` (captura + axe + visão + merge, sem UI), com score extra por camada e as duas precisões.",
  "Extras ignorados na precisão sem extras: landmark-one-main, region e target-size (este último também quando o axe mapeia para 2.5.8). Achados visuais de 2.5.5 não são extras.",
  "Sem Groq no modo com sugestões: a análise completa sai e a UI/diagnostics avisam a falta de sugestão — comportamento já existente, confirmado pelo caso de falha.",
  "Rodada de visão incompleta (chave ausente, 503 ou 429) não entra no recall visual como 0.",
  "Gemini 429 esgotou a cota nesta primeira rodada; o runner não retenta 429 e a camada visual das páginas restantes é pulada sem HTTP. Recall visual das rodadas incompletas não conta como 0.",
];

export interface RunPrecisionCoverageOptions {
  rounds?: number;
  outDir?: string;
  skipValidation?: boolean;
  skipBenchmark?: boolean;
  skipFailures?: boolean;
  resumeFrom?: string;
  reuseScreenshotsFrom?: string;
  rpm?: number;
  rpd?: number;
  repoRoot?: string;
}

function stampDirName(date = new Date()): string {
  const iso = date.toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z");
  return iso;
}

function fixtureDiff(repoRoot: string): string {
  try {
    return execFileSync(
      "git",
      ["diff", "--", "validation/pages", "benchmark/pages"],
      { cwd: repoRoot, encoding: "utf8" },
    );
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createQuotaSkipVisionLayer(): ReturnType<typeof createVisionAnalysisLayer> {
  return {
    async analyze() {
      throw new Error("Gemini 429 — limite de requisições");
    },
  };
}

function withVisionQuotaCircuit(
  layer: ReturnType<typeof createVisionAnalysisLayer>,
  alreadyExhausted = false,
): ReturnType<typeof createVisionAnalysisLayer> {
  let exhausted = alreadyExhausted;
  return {
    async analyze(page, analysisRun) {
      if (exhausted) {
        throw new Error("Gemini 429 — limite de requisições");
      }
      try {
        return await layer.analyze(page, analysisRun);
      } catch (error) {
        if (isQuotaVisionError(error)) {
          exhausted = true;
          console.log(
            "[visão] cota Gemini esgotada (429); pulando HTTP nas páginas restantes",
          );
        }
        throw error;
      }
    },
  };
}

function withVisionRetry(
  layer: ReturnType<typeof createVisionAnalysisLayer>,
): ReturnType<typeof createVisionAnalysisLayer> {
  return {
    analyze(page, analysisRun) {
      return retryVisionCall(() => layer.analyze(page, analysisRun), {
        attempts: VISION_RETRY_ATTEMPTS,
        delayMs: VISION_RETRY_DELAY_MS,
        onRetry: (error, attempt, attempts) => {
          const message = error instanceof Error ? error.message : String(error);
          console.log(
            `[visão] aguardando ${VISION_RETRY_DELAY_MS}ms para tentar de novo (${attempt + 1}/${attempts}) após: ${message}`,
          );
        },
      });
    },
  };
}

function geminiQuotaExhausted(
  resumed: Awaited<ReturnType<typeof loadResume>> | null,
): boolean {
  if (!resumed) {
    return false;
  }
  const texts = [
    ...resumed.validation.map((record) => record.error ?? ""),
    ...(resumed.benchmark ?? []).map((record) => record.error ?? ""),
    ...resumed.choices,
  ];
  return texts.some((text) => /429|limite de requisições/i.test(text));
}

function campaignChoices(
  resumed: Awaited<ReturnType<typeof loadResume>> | null,
): string[] {
  const base = resumed?.choices.length ? [...resumed.choices] : [...CHOICES];
  const quotaNote = CHOICES[CHOICES.length - 1]!;
  if (!base.some((item) => item.includes("Gemini 429 esgotou a cota"))) {
    base.push(quotaNote);
  }
  return base;
}

function createVisionLayer(
  env: NodeJS.ProcessEnv,
  onRawResponse: (page: CapturedPage, raw: string) => Promise<void>,
  skipImmediately = false,
  rate?: { rpm: number; rpd: number },
) {
  if (skipImmediately) {
    console.log("[visão] pulando camada visual (cota Gemini 429) — sem HTTP");
    return createQuotaSkipVisionLayer();
  }
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return createDefaultVisionLayer({ env, missingKey: "throw" });
  }
  const limiter = createGeminiRateLimiter({
    rpm: rate?.rpm ?? GEMINI_FLASH_LITE_RPM,
    rpd: rate?.rpd ?? GEMINI_FLASH_LITE_RPD,
  });
  console.log(
    `[visão] cota Gemini ${limiter.rpm} RPM / ${limiter.rpd} RPD`,
  );
  return withVisionQuotaCircuit(
    withVisionRetry(
      createVisionAnalysisLayer({
        geminiClient: withGeminiRateLimit(
          createGeminiClient({ apiKey, timeoutMs: 60_000 }),
          limiter,
        ),
        onRawResponse,
      }),
    ),
  );
}

function reuseChoices(sourceDir: string, rpm: number, rpd: number): string[] {
  return [
    ...CHOICES.filter((item) => !item.includes("Gemini 429 esgotou a cota nesta primeira")),
    `Screenshots reutilizados de ${sourceDir}; captura Playwright e axe não rodaram de novo.`,
    "Groq não foi reexecutado neste backfill; as asserções de sugestão de código ficam de fora.",
    `Gemini limitado a ${rpm} RPM e ${rpd} RPD (espaçamento mínimo entre generateContent).`,
  ];
}

export async function runPrecisionCoverage(
  options: RunPrecisionCoverageOptions = {},
): Promise<PrecisionCoverageSummary> {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  if (options.reuseScreenshotsFrom) {
    return runReusedPrecisionCoverage(options, repoRoot);
  }
  const resumeDir = options.resumeFrom
    ? path.isAbsolute(options.resumeFrom)
      ? options.resumeFrom
      : path.join(repoRoot, options.resumeFrom)
    : undefined;
  const resumed = resumeDir ? await loadResume(resumeDir) : null;
  const rounds = resumed?.rounds ?? options.rounds ?? 5;
  const outDir =
    resumeDir ??
    options.outDir ??
    path.join(repoRoot, "resultados", stampDirName());
  await mkdir(outDir, { recursive: true });

  const ambiente = resumed?.ambiente ?? (await collectEnvironment());
  const ctx: ArtifactContext = { dir: "" };
  const writers = bindArtifactWriters(ctx);
  const axeLayer = createAxeAnalysisLayer({
    htmlDir: path.join(outDir, "data", "axe-html"),
    onRawResults: writers.onRawAxe,
  });
  const skipVision = geminiQuotaExhausted(resumed);
  const visionLayer = createVisionLayer(
    process.env,
    writers.onRawGemini,
    skipVision,
    { rpm: options.rpm ?? GEMINI_FLASH_LITE_RPM, rpd: options.rpd ?? GEMINI_FLASH_LITE_RPD },
  );

  const validation: ValidationRoundRecord[] = resumed?.validation ?? [];
  const failures: FailureCaseRecord[] = (resumed?.failures ?? []).filter(
    (item) => item.id === "axe-html-missing-alt",
  );
  let servers: Awaited<ReturnType<typeof startCampaignServers>> | null = null;

  try {
    if (!options.skipValidation && !resumed) {
      servers = await startCampaignServers({
        repoRoot,
        dataDir: path.join(outDir, "data"),
        axeLayer,
        visionLayer,
      });
      const browser = await chromium.launch({ headless: true });
      try {
        let page = await launchDashboardPage(browser, CAPTURE_VIEWPORT);
        for (let round = 1; round <= rounds; round += 1) {
          for (const pageId of VALIDATION_PAGE_IDS) {
            for (const mode of ["audit", "fix"] as AnalyzeMode[]) {
              if (page.isClosed()) {
                page = await launchDashboardPage(browser, CAPTURE_VIEWPORT);
              }
              const record = await runValidationRound({
                page,
                webUrl: servers.webUrl,
                pageId,
                mode,
                round,
                outDir,
                ctx,
              });
              validation.push(record);
              console.log(
                `[validação] ${pageId} ${mode} r${round} ${record.status} ${record.assertions.filter((item) => !item.passed).length} falha(s)`,
              );
              await writeCampaignReport({
                outDir,
                ambiente,
                rounds,
                validation,
                benchmark: [],
                failures,
                fixtureDiff: fixtureDiff(repoRoot),
                choices: campaignChoices(resumed),
              });
              await delay(2_000);
            }
          }
        }

        const missingAltDir = path.join(
          outDir,
          "saidas",
          "missing-alt-axe-html",
        );
        ctx.dir = missingAltDir;
        try {
          const missingAlt = await runDashboardAnalysis(page, {
            webUrl: servers.webUrl,
            url: `${servers.apiUrl}/fixtures/benchmark/missing-alt.html`,
            mode: "audit",
            artifactDir: missingAltDir,
            captureAxeHtml: true,
          });
          await saveCapturedPage(missingAltDir, missingAlt.body.page);
          failures.push({
            id: "axe-html-missing-alt",
            pages: ["missing-alt"],
            passed: axeHtmlContainsSelector(
              missingAlt.axeHtml ?? "",
              "<img",
            ),
            expected: "HTML do axe contém a img sem alt no mesmo seletor",
            found: missingAlt.axeHtml?.includes("<img")
              ? "img presente no HTML analisado"
              : "img ausente",
          });
        } catch (error) {
          failures.push({
            id: "axe-html-missing-alt",
            pages: ["missing-alt"],
            passed: false,
            expected: "HTML do axe contém a img sem alt",
            found: errorMessage(error),
          });
        }
      } finally {
        await browser.close();
      }
    }

    collectOutputAssertions(validation, failures);

    if (!options.skipBenchmark) {
      const benchmark = await runBenchmarkCampaign({
        rounds,
        outDir,
        axeLayer,
        visionLayer,
        dbPath: path.join(outDir, "data", "benchmark.sqlite"),
        screenshotDir: path.join(outDir, "data", "screenshots"),
        pageDelayMs: skipVision ? 0 : 2_000,
        setArtifactDir: (dir) => {
          ctx.dir = dir;
        },
      });
      const summary: PrecisionCoverageSummary = {
        outDir,
        ambiente,
        rounds,
        validation,
        benchmark,
        failures: options.skipFailures
          ? failures
          : [...failures, ...(await runFailureCases({ dataDir: path.join(outDir, "data", "failures") }))],
        fixtureDiff: fixtureDiff(repoRoot),
        choices: campaignChoices(resumed),
      };
      await writeCampaignReport(summary);
      return summary;
    }

    const summary: PrecisionCoverageSummary = {
      outDir,
      ambiente,
      rounds,
      validation,
      benchmark: [],
      failures: options.skipFailures
        ? failures
        : [...failures, ...(await runFailureCases({ dataDir: path.join(outDir, "data", "failures") }))],
      fixtureDiff: fixtureDiff(repoRoot),
      choices: campaignChoices(resumed),
    };
    await writeCampaignReport(summary);
    return summary;
  } finally {
    await servers?.close();
  }
}

async function runValidationRound(options: {
  page: import("playwright").Page;
  webUrl: string;
  pageId: ValidationPageId;
  mode: AnalyzeMode;
  round: number;
  outDir: string;
  ctx: ArtifactContext;
}): Promise<ValidationRoundRecord> {
  const artifactDir = path.join(
    options.outDir,
    "validacao",
    options.pageId,
    options.mode,
    `round-${options.round}`,
  );
  options.ctx.dir = artifactDir;
  await mkdir(artifactDir, { recursive: true });
  const captureExport = options.round === 1 && options.mode === "audit";
  const captureAxeHtml =
    options.round === 1 &&
    options.mode === "audit" &&
    options.pageId === "03-somente-estruturais";

  const attempt = async () =>
    runDashboardAnalysis(options.page, {
      webUrl: options.webUrl,
      shortcutLabel: VALIDATION_SHORTCUTS[options.pageId],
      mode: options.mode,
      artifactDir,
      captureExport,
      captureAxeHtml,
    });

  let lastError = "";
  for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
    try {
      const result = await attempt();
      const visionFailed = Boolean(result.body.diagnostics.vision.error);
      if (visionFailed && tryIndex === 0) {
        throw new Error(result.body.diagnostics.vision.error);
      }
      await saveCapturedPage(artifactDir, result.body.page);
      const split = splitViolationsBySource(result.body.violations);
      const observation = {
        structural: split.structural,
        visual: split.visual,
        violations: result.body.violations,
        fixSuggestions: result.body.fixSuggestions,
        diagnostics: result.body.diagnostics,
      };
      const assertions = assertValidationPage(
        options.pageId,
        observation,
        options.mode,
      );
      assertions.push({
        id: "screenshot-fullpage",
        expected:
          "Screenshot da página inteira já renderizada, a mesma enviada ao Gemini",
        found: result.screenshotNote,
        passed: result.screenshotOk,
      });
      if (split.structural.length === 0) {
        assertions.push({
          id: "dom-structural-empty-label",
          expected: "Nenhuma violação estrutural encontrada",
          found: result.lists.structuralEmptyLabel
            ? "rótulo visível"
            : "rótulo ausente",
          passed: result.lists.structuralEmptyLabel,
        });
      }
      if (split.visual.length === 0) {
        assertions.push({
          id: "dom-visual-empty-label",
          expected: "Nenhuma violação visual encontrada",
          found: result.lists.visualEmptyLabel
            ? "rótulo visível"
            : "rótulo ausente",
          passed: result.lists.visualEmptyLabel,
        });
      }
      if (result.exportHtml) {
        const exported = exportMatchesLists(
          result.exportHtml,
          result.body.violations,
        );
        assertions.push({
          id: "html-export-lists",
          expected:
            "HTML exportado tem as mesmas duas seções e os mesmos itens das listas",
          found: exported.found,
          passed: exported.passed,
        });
      }
      if (result.axeHtml) {
        assertions.push({
          id: "axe-html-selector",
          expected: "DOM aberto pelo link contém a img que o axe reportou",
          found: axeHtmlContainsSelector(result.axeHtml, "<img")
            ? "img presente"
            : "img ausente",
          passed: axeHtmlContainsSelector(result.axeHtml, "<img"),
        });
      }
      return {
        pageId: options.pageId,
        mode: options.mode,
        round: options.round,
        status: visionFailed ? "incomplete" : "completed",
        error: visionFailed ? result.body.diagnostics.vision.error : undefined,
        assertions,
        observation,
        artifactDir,
      };
    } catch (error) {
      lastError = errorMessage(error);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        path.join(artifactDir, `error-try-${tryIndex + 1}.txt`),
        lastError,
        "utf8",
      );
      if (tryIndex === 0) {
        await delay(8_000);
      }
    }
  }

  return {
    pageId: options.pageId,
    mode: options.mode,
    round: options.round,
    status: "lost",
    error: lastError,
    assertions: [],
    artifactDir,
  };
}

async function runReusedPrecisionCoverage(
  options: RunPrecisionCoverageOptions,
  repoRoot: string,
): Promise<PrecisionCoverageSummary> {
  const sourceDir = path.isAbsolute(options.reuseScreenshotsFrom!)
    ? options.reuseScreenshotsFrom!
    : path.join(repoRoot, options.reuseScreenshotsFrom!);
  const rounds = options.rounds ?? 5;
  const rpm = options.rpm ?? GEMINI_FLASH_LITE_RPM;
  const rpd = options.rpd ?? GEMINI_FLASH_LITE_RPD;
  const outDir =
    options.outDir ?? path.join(repoRoot, "resultados", stampDirName());
  await mkdir(outDir, { recursive: true });

  const ambiente = await collectEnvironment();
  const ctx: ArtifactContext = { dir: "" };
  const writers = bindArtifactWriters(ctx);
  const visionLayer = createVisionLayer(
    process.env,
    writers.onRawGemini,
    false,
    { rpm, rpd },
  );
  const jobs = listReusableJobs(sourceDir, rounds);
  const validation: ValidationRoundRecord[] = [];
  const benchmark: PrecisionCoverageSummary["benchmark"] = [];
  const failures: FailureCaseRecord[] = [];
  const choices = reuseChoices(sourceDir, rpm, rpd);

  console.log(
    `[reuso] ${jobs.length} rodadas a partir de ${sourceDir} → ${outDir}`,
  );

  for (const job of jobs) {
    const destDir =
      job.kind === "validation"
        ? path.join(outDir, "validacao", job.pageId, job.mode, `round-${job.round}`)
        : path.join(outDir, "benchmark", job.pageId, `round-${job.round}`);
    ctx.dir = destDir;

    const record = destVisionAlreadyComplete(destDir)
      ? await hydrateReplayedRound(job, destDir)
      : await replayRound({ job, destDir, visionLayer });
    if (job.kind === "validation") {
      validation.push(record as ValidationRoundRecord);
    } else {
      benchmark.push(record as PrecisionCoverageSummary["benchmark"][number]);
    }
    const label =
      job.kind === "validation"
        ? `${job.pageId} ${job.mode}`
        : job.pageId;
    console.log(`[reuso] ${label} r${job.round} ${record.status}`);
    await writeCampaignReport({
      outDir,
      ambiente,
      rounds,
      validation,
      benchmark,
      failures,
      fixtureDiff: fixtureDiff(repoRoot),
      choices,
    });
  }

  const summary: PrecisionCoverageSummary = {
    outDir,
    ambiente,
    rounds,
    validation,
    benchmark,
    failures,
    fixtureDiff: fixtureDiff(repoRoot),
    choices,
  };
  await writeCampaignReport(summary);
  return summary;
}

function collectOutputAssertions(
  validation: ValidationRoundRecord[],
  failures: FailureCaseRecord[],
): void {
  const exports = validation.filter((record) =>
    record.assertions.some((item) => item.id === "html-export-lists"),
  );
  if (exports.length > 0) {
    failures.push({
      id: "html-export-01-a-04",
      pages: exports.map((item) => item.pageId),
      passed: exports.every((record) =>
        record.assertions.some(
          (item) => item.id === "html-export-lists" && item.passed,
        ),
      ),
      expected: "Export HTML das páginas 01–04 com as duas seções iguais ao dashboard",
      found: `${exports.filter((record) => record.assertions.some((item) => item.id === "html-export-lists" && item.passed)).length}/${exports.length} ok`,
    });
  }
  const screenshots = validation.filter((record) => record.status === "completed");
  failures.push({
    id: "captura-da-tela",
    pages: VALIDATION_PAGE_IDS.slice(),
    passed: screenshots.every((record) =>
      record.assertions.some(
        (item) => item.id === "screenshot-fullpage" && item.passed,
      ),
    ),
    expected: "Screenshot visível da página inteira em todas as rodadas de validação",
    found: `${screenshots.filter((record) => record.assertions.some((item) => item.id === "screenshot-fullpage" && item.passed)).length}/${screenshots.length} ok`,
  });
}
