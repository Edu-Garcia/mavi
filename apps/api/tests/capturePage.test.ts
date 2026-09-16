import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CaptureError, capturePage } from "../src/capture/capturePage.ts";

const fixtureHtml = fileURLToPath(
  new URL("./fixtures/sample.html", import.meta.url),
);

describe("capturePage", () => {
  let screenshotDir: string;

  afterEach(async () => {
    if (screenshotDir) {
      await rm(screenshotDir, { recursive: true, force: true });
    }
  });

  it("captura HTML renderizado e screenshot de uma página HTML local", async () => {
    screenshotDir = await mkdtemp(path.join(tmpdir(), "mavi-capture-"));

    const result = await capturePage(fixtureHtml, { screenshotDir });

    expect(result.html).toContain("Olá MAVI");
    expect(result.html).toContain('id="marker"');
    expect(result.url).toMatch(/^file:/);
    expect(result.screenshotPath.endsWith(".png")).toBe(true);
    expect(result.screenshotPath.startsWith(screenshotDir)).toBe(true);

    const screenshot = await readFile(result.screenshotPath);
    expect(screenshot.byteLength).toBeGreaterThan(0);
  });

  it("falha com reason invalid_url para fonte inválida", async () => {
    screenshotDir = await mkdtemp(path.join(tmpdir(), "mavi-capture-"));

    await expect(
      capturePage("http://", { screenshotDir }),
    ).rejects.toMatchObject({
      name: "CaptureError",
      reason: "invalid_url",
    } satisfies Partial<CaptureError>);
  });

  it("falha com reason http_error para respostas 4xx/5xx", async () => {
    screenshotDir = await mkdtemp(path.join(tmpdir(), "mavi-capture-"));
    const server = createServer((_req, res) => {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("unavailable");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("endereço do servidor de teste inválido");
    }

    try {
      await expect(
        capturePage(`http://127.0.0.1:${address.port}/down`, {
          screenshotDir,
        }),
      ).rejects.toMatchObject({
        name: "CaptureError",
        reason: "http_error",
        statusCode: 503,
      } satisfies Partial<CaptureError>);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("falha com reason timeout quando a navegação estoura o limite", async () => {
    screenshotDir = await mkdtemp(path.join(tmpdir(), "mavi-capture-"));
    const server = createServer(() => {
      // Mantém a conexão aberta sem responder.
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("endereço do servidor de teste inválido");
    }

    try {
      await expect(
        capturePage(`http://127.0.0.1:${address.port}/slow`, {
          screenshotDir,
          timeoutMs: 500,
        }),
      ).rejects.toMatchObject({
        name: "CaptureError",
        reason: "timeout",
      } satisfies Partial<CaptureError>);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
