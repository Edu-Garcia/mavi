export interface DiffViewerProps {
  diffBefore: string;
  diffAfter: string;
  explanation: string;
}

export function DiffViewer({
  diffBefore,
  diffAfter,
  explanation,
}: DiffViewerProps) {
  return (
    <div className="min-w-0">
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label="Código original"
          className="min-w-0 rounded-lg border border-border bg-alt p-3"
        >
          <h4 className="mt-0 mb-2 font-display text-sm font-semibold">
            Original
          </h4>
          <pre className="html-snippet m-0 max-w-full min-w-0 overflow-x-auto whitespace-pre text-sm">
            <code>{diffBefore}</code>
          </pre>
        </section>
        <section
          aria-label="Código corrigido"
          className="min-w-0 rounded-lg border border-border bg-alt p-3"
        >
          <h4 className="mt-0 mb-2 font-display text-sm font-semibold">
            Corrigido
          </h4>
          <pre className="html-snippet m-0 max-w-full min-w-0 overflow-x-auto whitespace-pre text-sm">
            <code>{diffAfter}</code>
          </pre>
        </section>
      </div>
      <p className="mb-0 mt-3 text-muted">{explanation}</p>
    </div>
  );
}
