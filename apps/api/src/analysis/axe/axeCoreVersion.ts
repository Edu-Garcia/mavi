import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function axeCoreVersion(): string {
  try {
    const pkg = require("axe-core/package.json") as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}
