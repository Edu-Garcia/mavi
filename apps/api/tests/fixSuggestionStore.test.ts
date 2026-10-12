import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FixSuggestion } from "@mavi/shared";
import {
  createFixSuggestionStore,
  type FixSuggestionStore,
} from "../src/db/fixSuggestionStore.ts";

function sampleSuggestion(
  overrides: Partial<FixSuggestion> = {},
): FixSuggestion {
  return {
    id: "fix-1",
    violationId: "violation-1",
    diffBefore: "<img>",
    diffAfter: '<img alt="Foto">',
    explanation: "Inclua alt descritivo.",
    generatedAt: new Date("2026-01-15T12:00:45.000Z"),
    ...overrides,
  };
}

describe("FixSuggestionStore", () => {
  let dataDir: string;
  let store: FixSuggestionStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mavi-fix-db-"));
    store = await createFixSuggestionStore(path.join(dataDir, "mavi.sqlite"));
  });

  afterEach(async () => {
    store?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persiste FixSuggestion e recupera por violationId", () => {
    const saved = store.save(sampleSuggestion());
    const loaded = store.getByViolationId("violation-1");

    expect(saved).toMatchObject({
      id: "fix-1",
      violationId: "violation-1",
      diffBefore: "<img>",
      diffAfter: '<img alt="Foto">',
      explanation: "Inclua alt descritivo.",
    });
    expect(loaded).toMatchObject({
      id: "fix-1",
      violationId: "violation-1",
      diffBefore: "<img>",
      diffAfter: '<img alt="Foto">',
      explanation: "Inclua alt descritivo.",
    });
    expect(loaded?.generatedAt).toEqual(
      new Date("2026-01-15T12:00:45.000Z"),
    );
  });

  it("salva várias e lista por ids de violação", () => {
    store.save(sampleSuggestion({ id: "fix-a", violationId: "v-a" }));
    store.save(
      sampleSuggestion({
        id: "fix-b",
        violationId: "v-b",
        diffBefore: "<h3>",
        diffAfter: "<h2>",
        explanation: "Ajuste heading.",
      }),
    );

    const listed = store.listByViolationIds(["v-b", "v-a", "missing"]);
    expect(listed).toHaveLength(2);
    expect(listed.map((s) => s.violationId).sort()).toEqual(["v-a", "v-b"]);
  });

  it("substitui sugestão existente para a mesma violação", () => {
    store.save(sampleSuggestion());
    store.save(
      sampleSuggestion({
        id: "fix-2",
        diffAfter: '<img alt="Produto em destaque">',
        explanation: "Alt mais específico.",
        generatedAt: new Date("2026-01-15T13:00:00.000Z"),
      }),
    );

    const loaded = store.getByViolationId("violation-1");
    expect(loaded?.id).toBe("fix-2");
    expect(loaded?.diffAfter).toBe('<img alt="Produto em destaque">');
    expect(loaded?.explanation).toBe("Alt mais específico.");
  });
});
