import type { FixSuggestion, Violation } from "@mavi/shared";
import { groupViolationsByIssue } from "../report/groupViolationsByIssue.ts";
import { groupViolationsByWcag } from "../report/groupViolationsByWcag.ts";
import { splitViolationsBySource } from "../report/splitViolationsBySource.ts";
import { ViolationCard } from "./ViolationCard.tsx";

export interface ViolationsReportProps {
  violations: Violation[];
  fixSuggestions?: FixSuggestion[];
}

export function ViolationsReport({
  violations,
  fixSuggestions = [],
}: ViolationsReportProps) {
  const fixesByViolationId = new Map(
    fixSuggestions.map((fix) => [fix.violationId, fix]),
  );
  const { structural, visual } = splitViolationsBySource(violations);

  return (
    <div className="grid min-w-0 gap-8">
      <h2 className="m-0 font-display text-2xl font-semibold text-primary">
        Violações
      </h2>
      <LayerSection
        title="Violações estruturais"
        emptyLabel="Nenhuma violação estrutural encontrada."
        layer="estrutural"
        violations={structural}
        fixesByViolationId={fixesByViolationId}
      />
      <LayerSection
        title="Violações visuais"
        emptyLabel="Nenhuma violação visual encontrada."
        layer="visual"
        violations={visual}
        fixesByViolationId={fixesByViolationId}
      />
    </div>
  );
}

function LayerSection({
  title,
  emptyLabel,
  layer,
  violations,
  fixesByViolationId,
}: {
  title: string;
  emptyLabel: string;
  layer: "estrutural" | "visual";
  violations: Violation[];
  fixesByViolationId: Map<string, FixSuggestion>;
}) {
  const groups = groupViolationsByWcag(violations);

  return (
    <section aria-label={title} className="grid min-w-0 gap-4">
      <h3 className="m-0 font-display text-xl font-semibold text-primary">
        {title}
      </h3>
      {groups.length === 0 ? (
        <p className="m-0 text-muted">{emptyLabel}</p>
      ) : (
        groups.map((group) => (
          <section
            key={`${layer}-${group.wcagCriterion}`}
            aria-label={`Critério ${group.wcagCriterion} — ${layer}`}
            className="grid min-w-0 gap-3"
          >
            <h4 className="m-0 font-display text-lg font-semibold text-primary">
              {group.wcagCriterion}
            </h4>
            <ul className="m-0 grid min-w-0 list-none gap-3 p-0">
              {groupViolationsByIssue(group.violations).map((issue) => (
                <li key={issue.key} className="min-w-0">
                  <ViolationCard
                    occurrences={issue.violations.map((violation) => ({
                      violation,
                      fixSuggestion: fixesByViolationId.get(violation.id),
                    }))}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
