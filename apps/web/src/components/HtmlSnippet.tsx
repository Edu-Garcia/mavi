export interface HtmlSnippetProps {
  html: string;
  label?: string;
}

export function HtmlSnippet({ html, label }: HtmlSnippetProps) {
  return (
    <pre
      aria-label={label}
      className="html-snippet m-0 max-w-full min-w-0 overflow-x-auto whitespace-pre rounded-lg bg-alt p-3 text-sm text-ink"
    >
      <code>{html}</code>
    </pre>
  );
}
