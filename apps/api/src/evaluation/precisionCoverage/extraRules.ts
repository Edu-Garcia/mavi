/**
 * Achados reais do axe em páginas mínimas, mas fora do gabarito.
 * Lista fixa do plano de precisão/cobertura.
 */
export const EXTRA_AXE_RULE_IDS = [
  "landmark-one-main",
  "region",
  "target-size",
] as const;

export type ExtraAxeRuleId = (typeof EXTRA_AXE_RULE_IDS)[number];
