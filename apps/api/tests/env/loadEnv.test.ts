import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEnvValues,
  findRepoRoot,
  loadEnv,
  parseEnvFile,
} from "../../src/env/loadEnv.ts";

describe("loadEnv", () => {
  it("parseia KEY=VALUE e ignora comentários", () => {
    const parsed = parseEnvFile(`
# comentário
GEMINI_API_KEY=abc123
GROQ_API_KEY="quoted"
EMPTY=
`);
    expect(parsed.GEMINI_API_KEY).toBe("abc123");
    expect(parsed.GROQ_API_KEY).toBe("quoted");
    expect(parsed.EMPTY).toBe("");
  });

  it("não sobrescreve variáveis já definidas", () => {
    const env: NodeJS.ProcessEnv = { GEMINI_API_KEY: "existente" };
    applyEnvValues({ GEMINI_API_KEY: "nova", GROQ_API_KEY: "groq" }, env);
    expect(env.GEMINI_API_KEY).toBe("existente");
    expect(env.GROQ_API_KEY).toBe("groq");
  });

  it("carrega .env a partir da raiz do repositório", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mavi-env-"));
    await mkdir(path.join(root, "apps", "api"), { recursive: true });
    await writeFile(path.join(root, "package.json"), '{"name":"mavi"}');
    await writeFile(path.join(root, ".env"), "GEMINI_API_KEY=from-file\n");

    const env: NodeJS.ProcessEnv = {};
    const loaded = loadEnv({ cwd: path.join(root, "apps", "api"), env });
    expect(loaded).toBe(path.join(root, ".env"));
    expect(env.GEMINI_API_KEY).toBe("from-file");
    expect(findRepoRoot(path.join(root, "apps", "api"))).toBe(root);
  });
});
