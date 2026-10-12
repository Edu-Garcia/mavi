import { useState } from "react";
import type { FixSuggestion, Violation } from "@mavi/shared";
import { DiffViewer } from "./DiffViewer.tsx";

export interface ViolationCardProps {
  violation: Violation;
  fixSuggestion?: FixSuggestion;
}

export function ViolationCard({
  violation,
  fixSuggestion,
}: ViolationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article>
      <p>{violation.description}</p>
      <p>
        Severidade: <span>{violation.severity}</span>
      </p>
      <pre>
        <code>{violation.htmlSnippet}</code>
      </pre>
      {fixSuggestion ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Ocultar correção" : "Ver correção"}
          </button>
          {expanded ? (
            <DiffViewer
              diffBefore={fixSuggestion.diffBefore}
              diffAfter={fixSuggestion.diffAfter}
              explanation={fixSuggestion.explanation}
            />
          ) : null}
        </>
      ) : null}
    </article>
  );
}
