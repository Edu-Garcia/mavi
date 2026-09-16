import path from "node:path";
import { createAnalysisStore } from "./db/analysisStore.ts";
import { buildApp } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? path.resolve("data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "mavi.db");
const screenshotDir =
  process.env.SCREENSHOT_DIR ?? path.join(dataDir, "screenshots");

const store = await createAnalysisStore(dbPath);
const app = await buildApp({ store, screenshotDir });

await app.listen({ port, host: "0.0.0.0" });
console.log(`MAVI API em http://0.0.0.0:${port}`);
