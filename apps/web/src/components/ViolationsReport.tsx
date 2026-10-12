import type { FixSuggestion, Violation } from "@mavi/shared";
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
    return <p>Nenhuma violação encontrada.</p>;
  }

  return (
    <div>
      <h2>Violações</h2>
      {groups.map((group) => (
        <section
          key={group.wcagCriterion}
          aria-label={`Critério ${group.wcagCriterion}`}
        >
          <h3>{group.wcagCriterion}</h3>
          <ul>
            {group.violations.map((violation) => (
              <li key={violation.id}>
                <ViolationCard
                  violation={violation}
                  fixSuggestion={fixesByViolationId.get(violation.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
