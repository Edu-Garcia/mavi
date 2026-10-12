import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createBenchmarkCaseStore,
  type BenchmarkCaseStore,
} from "../../src/db/benchmarkCaseStore.ts";
import { loadBenchmarkCatalog } from "../../src/benchmark/loadBenchmarkCatalog.ts";
import { persistBenchmarkCatalog } from "../../src/benchmark/persistBenchmarkCatalog.ts";

describe("BenchmarkCaseStore", () => {
  let dataDir: string;
  let store: BenchmarkCaseStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-bench-"));
    store = await createBenchmarkCaseStore(path.join(dataDir, "mavi.sqlite"));
  });

  afterEach(async () => {
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persiste BenchmarkCase com ground truth e permite recuperá-lo", () => {
    const page = store.savePage({
      url: "file:///benchmark/pages/missing-alt.html",
      capturedHtml: "<html><img src='produto.jpg'></html>",
      screenshotPath: "/tmp/screenshots/missing-alt.png",
    });

    const saved = store.saveBenchmarkCase({
      pageId: page.id,
      groundTruthViolations: [
        {
          wcagCriterion: "1.1.1 Non-text Content",
          location: "img[src='produto.jpg']",
        },
      ],
    });

    const loaded = store.getBenchmarkCase(saved.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.pageId).toBe(page.id);
    expect(loaded?.groundTruthViolations).toEqual([
      {
        wcagCriterion: "1.1.1 Non-text Content",
        location: "img[src='produto.jpg']",
      },
    ]);
  });
});

describe("persistBenchmarkCatalog", () => {
  let dataDir: string;
  let store: BenchmarkCaseStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-bench-persist-"));
    store = await createBenchmarkCaseStore(path.join(dataDir, "mavi.sqlite"));
  });

  afterEach(async () => {
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persiste cada entrada do catálogo como BenchmarkCase recuperável com gabarito", async () => {
    const catalog = loadBenchmarkCatalog();
    const cases = await persistBenchmarkCatalog(catalog, store);

    expect(cases).toHaveLength(catalog.length);

    for (const entry of catalog) {
      const matching = cases.find((c) =>
        c.groundTruthViolations.some(
          (gt) =>
            gt.wcagCriterion === entry.groundTruthViolations[0]?.wcagCriterion &&
            gt.location === entry.groundTruthViolations[0]?.location,
        ),
      );
      expect(matching).toBeDefined();

      const loaded = store.getBenchmarkCase(matching!.id);
      expect(loaded?.groundTruthViolations).toEqual(entry.groundTruthViolations);

      const page = store.getPage(matching!.pageId);
      expect(page?.capturedHtml).toBe(entry.pageHtml);
      expect(page?.url).toContain(entry.id);
    }

    const listed = store.listBenchmarkCases();
    expect(listed).toHaveLength(catalog.length);
  });
});
