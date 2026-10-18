export interface TestPageShortcut {
  id: string;
  label: string;
  url: string;
}

export function testPageShortcuts(apiBaseUrl: string): TestPageShortcut[] {
  const base = apiBaseUrl.replace(/\/$/, "");
  return [
    {
      id: "validation-01",
      label: "Validação — controle (sem violações)",
      url: `${base}/fixtures/validation/01-controle.html`,
    },
    {
      id: "validation-02",
      label: "Validação — só visuais",
      url: `${base}/fixtures/validation/02-somente-visuais.html`,
    },
    {
      id: "validation-03",
      label: "Validação — só estruturais",
      url: `${base}/fixtures/validation/03-somente-estruturais.html`,
    },
    {
      id: "validation-04",
      label: "Validação — visuais e estruturais",
      url: `${base}/fixtures/validation/04-visuais-e-estruturais.html`,
    },
    {
      id: "benchmark-alt",
      label: "Benchmark — imagem sem alt",
      url: `${base}/fixtures/benchmark/missing-alt.html`,
    },
    {
      id: "benchmark-contrast",
      label: "Benchmark — contraste dinâmico",
      url: `${base}/fixtures/benchmark/dynamic-contrast.html`,
    },
  ];
}
