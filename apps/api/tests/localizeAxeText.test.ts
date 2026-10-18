import { describe, expect, it } from "vitest";
import { localizeAxeDescription } from "../src/analysis/axe/localizeAxeText.ts";

describe("localizeAxeDescription", () => {
  it("usa o locale pt-BR do axe-core para image-alt", () => {
    const description = localizeAxeDescription(
      "image-alt",
      "Images must have alternate text",
      "Element does not have an alt attribute",
    );
    expect(description).toMatch(/texto alternativo/i);
    expect(description).not.toMatch(/Images must have alternate text/i);
  });
});
