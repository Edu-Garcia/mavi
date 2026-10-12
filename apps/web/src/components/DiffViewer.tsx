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
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <section aria-label="Código original">
          <h4>Original</h4>
          <pre>
            <code>{diffBefore}</code>
          </pre>
        </section>
        <section aria-label="Código corrigido">
          <h4>Corrigido</h4>
          <pre>
            <code>{diffAfter}</code>
          </pre>
        </section>
      </div>
      <p>{explanation}</p>
    </div>
  );
}
