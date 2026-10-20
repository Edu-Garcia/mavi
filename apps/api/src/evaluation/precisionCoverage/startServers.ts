import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AnalysisLayer } from "@mavi/shared";
import { createAnalysisStore, type AnalysisStore } from "../../db/analysisStore.ts";
import { createFixSuggestionStore } from "../../db/fixSuggestionStore.ts";
import { buildApp } from "../../server.ts";

export interface CampaignServers {
  apiUrl: string;
  webUrl: string;
  app: FastifyInstance;
  store: AnalysisStore;
  close: () => Promise<void>;
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timeout esperando ${url}: ${lastError}`);
}

function startVite(options: {
  repoRoot: string;
  port: number;
  apiUrl: string;
}): ChildProcess {
  const webDir = path.join(options.repoRoot, "apps", "web");
  const child = spawn(
    "npx",
    ["vite", "--host", "127.0.0.1", "--port", String(options.port), "--strictPort"],
    {
      cwd: webDir,
      env: {
        ...process.env,
        VITE_API_URL: options.apiUrl,
      },
      shell: true,
      stdio: "pipe",
    },
  );
  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (text.includes("Local:") || text.includes("error")) {
      process.stdout.write(`[web] ${text}`);
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[web] ${chunk.toString()}`);
  });
  return child;
}

export async function startCampaignServers(options: {
  repoRoot: string;
  dataDir: string;
  axeLayer: AnalysisLayer;
  visionLayer: AnalysisLayer;
  apiPort?: number;
  webPort?: number;
}): Promise<CampaignServers> {
  const apiPort = options.apiPort ?? 3010;
  const webPort = options.webPort ?? 5174;
  const dbPath = path.join(options.dataDir, "mavi.sqlite");
  const screenshotDir = path.join(options.dataDir, "screenshots");
  const axeHtmlDir = path.join(options.dataDir, "axe-html");
  const store = await createAnalysisStore(dbPath);
  const fixSuggestionStore = await createFixSuggestionStore(dbPath);
  const app = await buildApp({
    store,
    screenshotDir,
    axeHtmlDir,
    axeLayer: options.axeLayer,
    visionLayer: options.visionLayer,
    fixSuggestionStore,
    logger: false,
    repoRoot: options.repoRoot,
  });
  await app.listen({ port: apiPort, host: "127.0.0.1" });
  app.server.setTimeout(0);
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  await waitForHttp(`${apiUrl}/health`, 15_000);

  const vite = startVite({
    repoRoot: options.repoRoot,
    port: webPort,
    apiUrl,
  });
  const webUrl = `http://127.0.0.1:${webPort}`;
  try {
    await waitForHttp(webUrl, 30_000);
  } catch (error) {
    vite.kill();
    await app.close();
    store.close();
    throw error;
  }

  return {
    apiUrl,
    webUrl,
    app,
    store,
    close: async () => {
      vite.kill();
      await app.close();
      store.close();
      fixSuggestionStore.close();
    },
  };
}
