import type { Violation } from "@mavi/shared";
import { groupViolationsByWcag } from "../report/groupViolationsByWcag.ts";

export interface ViolationsReportProps {
  violations: Violation[];
}

export function ViolationsReport({ violations }: ViolationsReportProps) {
  const groups = groupViolationsByWcag(violations);

  if (groups.length === 0) {
    return <p>Nenhuma violação estrutural encontrada.</p>;
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
                <p>{violation.description}</p>
                <p>
                  Severidade: <span>{violation.severity}</span>
                </p>
                <pre>
                  <code>{violation.htmlSnippet}</code>
                </pre>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
