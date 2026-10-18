import { useState } from "react";
import type { FixSuggestion, Violation } from "@mavi/shared";
import { SOURCE_LAYER_LABEL } from "../labels/violations.ts";
import { DiffViewer } from "./DiffViewer.tsx";
import { HtmlSnippet } from "./HtmlSnippet.tsx";
import { SeverityBadge } from "./SeverityBadge.tsx";

export interface ViolationOccurrence {
  violation: Violation;
  fixSuggestion?: FixSuggestion;
}

export interface ViolationCardProps {
  occurrences: ViolationOccurrence[];
}

export function ViolationCard({ occurrences }: ViolationCardProps) {
  const first = occurrences[0];
  if (!first) {
    return null;
  }

  const { violation } = first;

  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="m-0 text-ink">{violation.description}</p>
      <p className="mt-3 mb-0 text-sm text-muted">
        Severidade: <SeverityBadge severity={violation.severity} />
      </p>
      <p className="mt-2 mb-0 text-sm text-muted">
        Origem: {SOURCE_LAYER_LABEL[violation.sourceLayer]}
      </p>
      <ol
        aria-label="Trechos HTML"
        className="mt-3 mb-0 grid list-none gap-3 p-0"
      >
        {occurrences.map((occurrence, index) => (
          <li key={occurrence.violation.id} className="min-w-0">
            {occurrences.length > 1 ? (
              <p className="mt-0 mb-2 text-xs font-semibold uppercase tracking-wide text-accent-dark">
                Local {index + 1}
              </p>
            ) : null}
            <HtmlSnippet
              html={occurrence.violation.htmlSnippet}
              label={`Trecho HTML ${index + 1}`}
            />
            <OccurrenceFix occurrence={occurrence} />
          </li>
        ))}
      </ol>
    </article>
  );
}

function OccurrenceFix({ occurrence }: { occurrence: ViolationOccurrence }) {
  const [expanded, setExpanded] = useState(false);
  const { fixSuggestion } = occurrence;

  if (!fixSuggestion) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="mt-4 cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-alt"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Ocultar correção" : "Ver correção"}
      </button>
      {expanded ? (
        <div className="mt-4 min-w-0">
          <DiffViewer
            diffBefore={fixSuggestion.diffBefore}
            diffAfter={fixSuggestion.diffAfter}
            explanation={fixSuggestion.explanation}
          />
        </div>
      ) : null}
    </>
  );
}
