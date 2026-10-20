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

/** Controle e falhas do levantamento Datacorp / Movimento Web para Todos. */
export function datacorpPageShortcuts(apiBaseUrl: string): TestPageShortcut[] {
  const base = apiBaseUrl.replace(/\/$/, "");
  return [
    {
      id: "datacorp-control",
      label: "Datacorp — controle (passa nos critérios)",
      url: `${base}/fixtures/datacorp/controle.html`,
    },
    {
      id: "datacorp-forms-pass",
      label: "Datacorp — formulário correto",
      url: `${base}/fixtures/datacorp/formulario-passa.html`,
    },
    {
      id: "datacorp-links-pass",
      label: "Datacorp — links corretos",
      url: `${base}/fixtures/datacorp/links-passa.html`,
    },
    {
      id: "datacorp-images-pass",
      label: "Datacorp — imagens corretas",
      url: `${base}/fixtures/datacorp/imagens-passa.html`,
    },
    {
      id: "datacorp-html-pass",
      label: "Datacorp — HTML válido (W3C)",
      url: `${base}/fixtures/datacorp/marcacao-passa.html`,
    },
    {
      id: "datacorp-forms",
      label: "Datacorp — formulário sem rótulo",
      url: `${base}/fixtures/datacorp/formulario.html`,
    },
    {
      id: "datacorp-links",
      label: "Datacorp — link em nova janela",
      url: `${base}/fixtures/datacorp/links.html`,
    },
    {
      id: "datacorp-images",
      label: "Datacorp — imagem sem alternativa",
      url: `${base}/fixtures/datacorp/imagens.html`,
    },
    {
      id: "datacorp-html",
      label: "Datacorp — HTML inválido (W3C)",
      url: `${base}/fixtures/datacorp/marcacao-html.html`,
    },
    {
      id: "datacorp-mixed",
      label: "Datacorp — mista (formulário e links falham)",
      url: `${base}/fixtures/datacorp/mista.html`,
    },
  ];
}
