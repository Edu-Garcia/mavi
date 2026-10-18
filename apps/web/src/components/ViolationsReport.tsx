import type { FixSuggestion, Violation } from "@mavi/shared";
import { groupViolationsByIssue } from "../report/groupViolationsByIssue.ts";
import { groupViolationsByWcag } from "../report/groupViolationsByWcag.ts";
import { ViolationCard } from "./ViolationCard.tsx";

export interface ViolationsReportProps {
  violations: Violation[];
  fixSuggestions?: FixSuggestion[];
}

export function ViolationsReport({
  violations,
  fixSuggestions = [],
}: ViolationsReportProps) {
  const groups = groupViolationsByWcag(violations);
  const fixesByViolationId = new Map(
    fixSuggestions.map((fix) => [fix.violationId, fix]),
  );

  if (groups.length === 0) {
    return <p className="text-muted">Nenhuma violação encontrada.</p>;
  }

  return (
    <div className="grid min-w-0 gap-6">
      <h2 className="m-0 font-display text-2xl font-semibold text-primary">
        Violações
      </h2>
      {groups.map((group) => (
        <section
          key={group.wcagCriterion}
          aria-label={`Critério ${group.wcagCriterion}`}
          className="grid min-w-0 gap-3"
        >
          <h3 className="m-0 font-display text-lg font-semibold text-primary">
            {group.wcagCriterion}
          </h3>
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
      ))}
    </div>
  );
}
