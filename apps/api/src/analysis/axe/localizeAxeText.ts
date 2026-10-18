import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePtBr = require("axe-core/locales/pt_BR.json") as {
  rules?: Record<string, { help?: string; description?: string }>;
};

export function localizeAxeDescription(
  ruleId: string,
  fallbackHelp: string,
  fallbackDetail: string,
): string {
  const rule = axePtBr.rules?.[ruleId];
  const help = rule?.help?.trim() || fallbackHelp;
  const detail = rule?.description?.trim() || fallbackDetail;
  return `${help}: ${detail}`;
}
