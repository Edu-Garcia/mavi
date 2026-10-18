export type OptionalLayerName = "vision" | "groq";

export type OptionalLayerSkipReason = "missing_key" | "audit_mode";

export class OptionalLayerSkip extends Error {
  readonly layer: OptionalLayerName;
  readonly skippedReason: OptionalLayerSkipReason;

  constructor(layer: OptionalLayerName, skippedReason: OptionalLayerSkipReason) {
    super(`${layer} skipped: ${skippedReason}`);
    this.name = "OptionalLayerSkip";
    this.layer = layer;
    this.skippedReason = skippedReason;
  }
}
