import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, "package.json");
    const hasApps = existsSync(path.join(dir, "apps", "api"));
    if (existsSync(pkgPath) && hasApps) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return path.resolve(startDir);
}

export function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function applyEnvValues(
  values: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

export function loadEnv(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const env = options?.env ?? process.env;
  const root = findRepoRoot(options?.cwd ?? process.cwd());
  const filePath = path.join(root, ".env");
  if (!existsSync(filePath)) {
    return null;
  }
  applyEnvValues(parseEnvFile(readFileSync(filePath, "utf8")), env);
  return filePath;
}

export function apiKeysPresent(env: NodeJS.ProcessEnv = process.env): {
  gemini: boolean;
  groq: boolean;
} {
  return {
    gemini: Boolean(env.GEMINI_API_KEY?.trim()),
    groq: Boolean(env.GROQ_API_KEY?.trim()),
  };
}

export function formatKeyStatus(configured: boolean): string {
  return configured ? "configurada" : "ausente";
}
