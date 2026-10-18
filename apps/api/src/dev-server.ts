import path from "node:path";
import { createAnalysisStore } from "./db/analysisStore.ts";
import { createFixSuggestionStore } from "./db/fixSuggestionStore.ts";
import { apiKeysPresent, formatKeyStatus, loadEnv } from "./env/loadEnv.ts";
import { buildApp } from "./server.ts";

loadEnv();

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? path.resolve("data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "mavi.db");
const screenshotDir =
  process.env.SCREENSHOT_DIR ?? path.join(dataDir, "screenshots");
const axeHtmlDir = process.env.AXE_HTML_DIR ?? path.join(dataDir, "axe-html");

const store = await createAnalysisStore(dbPath);
const fixSuggestionStore = await createFixSuggestionStore(dbPath);
const app = await buildApp({
  store,
  screenshotDir,
  axeHtmlDir,
  fixSuggestionStore,
  logger: true,
});

await app.listen({ port, host: "0.0.0.0" });

const keys = apiKeysPresent();
console.log("");
console.log(`MAVI API  http://0.0.0.0:${port}`);
console.log(`Gemini    ${formatKeyStatus(keys.gemini)}`);
console.log(`Groq      ${formatKeyStatus(keys.groq)}`);
console.log("");
