import type { ViolationSeverity } from "@mavi/shared";
import { SEVERITY_LABEL } from "../labels/violations.ts";

const SEVERITY_CLASS: Record<ViolationSeverity, string> = {
  critical: "bg-critical/10 text-critical border-critical/30",
  serious: "bg-serious/10 text-serious border-serious/30",
  moderate: "bg-moderate/10 text-moderate border-moderate/30",
  minor: "bg-minor/10 text-minor border-minor/30",
};

export function SeverityBadge({ severity }: { severity: ViolationSeverity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
