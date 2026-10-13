import { useState } from "react";
import type { FixSuggestion, SourceLayer, Violation } from "@mavi/shared";
import { DiffViewer } from "./DiffViewer.tsx";

export interface ViolationCardProps {
  violation: Violation;
  fixSuggestion?: FixSuggestion;
}

const SOURCE_LAYER_LABEL: Record<SourceLayer, string> = {
  axe: "axe",
  vision: "visão",
  both: "ambas (axe + visão)",
};

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
      <p>Origem: {SOURCE_LAYER_LABEL[violation.sourceLayer]}</p>
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
