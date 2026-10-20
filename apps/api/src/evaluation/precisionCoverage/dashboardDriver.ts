import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Browser, Locator, Page } from "playwright";
import type {
  AnalyzeDiagnostics,
  FixSuggestion,
  Violation,
} from "@mavi/shared";
import { emptyAnalyzeDiagnostics } from "@mavi/shared";
import { splitViolationsBySource } from "./splitBySource.ts";
import type { AnalyzeMode, ValidationPageId } from "./types.ts";

export const VALIDATION_SHORTCUTS: Record<ValidationPageId, string> = {
  "01-controle": "Validação — controle (sem violações)",
  "02-somente-visuais": "Validação — só visuais",
  "03-somente-estruturais": "Validação — só estruturais",
  "04-visuais-e-estruturais": "Validação — visuais e estruturais",
};

export interface AnalyzeSuccessBody {
  page: {
    id: string;
    url: string;
    capturedHtml: string;
    screenshotPath: string;
  };
  analysisRun: { id: string };
  violations: Violation[];
  fixSuggestions: FixSuggestion[];
  diagnostics: AnalyzeDiagnostics;
}

export interface DashboardRunResult {
  body: AnalyzeSuccessBody;
  exportHtml?: string;
  axeHtml?: string;
  screenshotOk: boolean;
  screenshotNote: string;
  lists: {
    structuralEmptyLabel: boolean;
    visualEmptyLabel: boolean;
    structuralCriteria: string[];
    visualCriteria: string[];
  };
}

const ANALYZE_TIMEOUT_MS = 180_000;

function modeLabel(mode: AnalyzeMode): string {
  return mode === "audit"
    ? "Auditoria (sem correções de código)"
    : "Com sugestões de código";
}

async function criterionHeadings(section: Locator): Promise<string[]> {
  return section.locator("h4").allTextContents();
}

export async function runDashboardAnalysis(
  page: Page,
  options: {
    webUrl: string;
    shortcutLabel?: string;
    url?: string;
    mode: AnalyzeMode;
    artifactDir: string;
    captureExport?: boolean;
    captureAxeHtml?: boolean;
  },
): Promise<DashboardRunResult> {
  await mkdir(options.artifactDir, { recursive: true });
  await page.goto(options.webUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: modeLabel(options.mode) }).check();

  if (options.shortcutLabel) {
    await page.getByRole("button", { name: options.shortcutLabel }).click();
  } else if (options.url) {
    await page.getByLabel("URL").fill(options.url);
  } else {
    throw new Error("Informe shortcutLabel ou url");
  }

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/analyze") &&
      response.request().method() === "POST",
    { timeout: ANALYZE_TIMEOUT_MS },
  );
  await page.getByRole("button", { name: "Analisar" }).click();
  const response = await responsePromise;
  const body = (await response.json()) as AnalyzeSuccessBody;
  if (response.status() !== 200 || !body.page) {
    throw new Error(
      `POST /analyze falhou (${response.status()}): ${JSON.stringify(body)}`,
    );
  }

  await page
    .getByRole("region", { name: "Relatório" })
    .waitFor({ timeout: ANALYZE_TIMEOUT_MS });

  const structural = page.getByRole("region", { name: "Violações estruturais" });
  const visual = page.getByRole("region", { name: "Violações visuais" });
  const structuralText = await structural.textContent();
  const visualText = await visual.textContent();
  const lists = {
    structuralEmptyLabel: (structuralText ?? "").includes(
      "Nenhuma violação estrutural encontrada",
    ),
    visualEmptyLabel: (visualText ?? "").includes(
      "Nenhuma violação visual encontrada",
    ),
    structuralCriteria: await criterionHeadings(structural),
    visualCriteria: await criterionHeadings(visual),
  };

  const img = page.getByRole("img", { name: /screenshot de/i });
  await img.waitFor({ state: "visible", timeout: 30_000 });
  const screenshotOk = await img.evaluate((element) => {
    const image = element as unknown as {
      complete: boolean;
      naturalWidth: number;
      naturalHeight: number;
    };
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });

  let exportHtml: string | undefined;
  if (options.captureExport) {
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: /exportar relatório html/i }).click();
    const download = await downloadPromise;
    const exportPath = path.join(options.artifactDir, "exported.html");
    await download.saveAs(exportPath);
    exportHtml = await readFile(exportPath, "utf8");
  }

  let axeHtml: string | undefined;
  if (options.captureAxeHtml) {
    const popupPromise = page.waitForEvent("popup", { timeout: 30_000 });
    await page
      .getByRole("link", { name: /abrir html analisado pelo axe/i })
      .click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    axeHtml = await popup.content();
    await writeFile(path.join(options.artifactDir, "axe-html.html"), axeHtml, "utf8");
    await popup.close();
  }

  await writeFile(
    path.join(options.artifactDir, "analyze.json"),
    `${JSON.stringify(
      {
        ...body,
        diagnostics: body.diagnostics ?? emptyAnalyzeDiagnostics(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    body: {
      ...body,
      diagnostics: body.diagnostics ?? emptyAnalyzeDiagnostics(),
      violations: body.violations ?? [],
      fixSuggestions: body.fixSuggestions ?? [],
    },
    exportHtml,
    axeHtml,
    screenshotOk,
    screenshotNote: screenshotOk
      ? "screenshot visível com dimensões > 0 (fullPage da captura)"
      : "screenshot ausente ou 0×0",
    lists,
  };
}

export function exportMatchesLists(
  html: string,
  violations: Violation[],
): { passed: boolean; found: string } {
  const { structural, visual } = splitViolationsBySource(violations);
  const hasSections =
    html.includes("Violações estruturais") && html.includes("Violações visuais");
  const structuralOk =
    structural.length === 0
      ? html.includes("Nenhuma violação estrutural encontrada")
      : structural.every((item) => html.includes(item.wcagCriterion));
  const visualOk =
    visual.length === 0
      ? html.includes("Nenhuma violação visual encontrada")
      : visual.every((item) => html.includes(item.wcagCriterion));
  const passed = hasSections && structuralOk && visualOk;
  return {
    passed,
    found: passed
      ? "export tem as duas seções e os mesmos critérios das listas"
      : `seções=${hasSections} estruturalOk=${structuralOk} visualOk=${visualOk}`,
  };
}

export function axeHtmlContainsSelector(
  html: string,
  selectorHint: string,
): boolean {
  return html.toLowerCase().includes(selectorHint.toLowerCase());
}

export async function launchDashboardPage(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<Page> {
  const context = await browser.newContext({
    viewport,
    acceptDownloads: true,
  });
  return context.newPage();
}
