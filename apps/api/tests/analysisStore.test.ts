import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAnalysisStore,
  type AnalysisStore,
} from "../src/db/analysisStore.ts";

describe("AnalysisStore", () => {
  let dataDir: string;
  let store: AnalysisStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-db-"));
    store = await createAnalysisStore(path.join(dataDir, "mavi.sqlite"));
  });

  afterEach(async () => {
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persiste Page e AnalysisRun e permite recuperá-los juntos", async () => {
    const page = store.savePage({
      url: "file:///tmp/sample.html",
      capturedHtml: "<html><body>Olá</body></html>",
      screenshotPath: "/tmp/screenshots/page.png",
    });

    const analysisRun = store.saveAnalysisRun({
      pageId: page.id,
      status: "completed",
      modelVersions: {},
    });

    const loaded = store.getAnalysisRun(analysisRun.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.page).toMatchObject({
      id: page.id,
      url: "file:///tmp/sample.html",
      capturedHtml: "<html><body>Olá</body></html>",
      screenshotPath: "/tmp/screenshots/page.png",
    });
    expect(loaded?.page.createdAt).toBeInstanceOf(Date);
    expect(loaded?.analysisRun).toMatchObject({
      id: analysisRun.id,
      pageId: page.id,
      status: "completed",
      modelVersions: {},
    });
    expect(loaded?.analysisRun.startedAt).toBeInstanceOf(Date);
    expect(loaded?.analysisRun.completedAt).toBeInstanceOf(Date);
  });
});
