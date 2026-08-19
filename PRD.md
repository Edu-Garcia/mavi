# PRD — MAVI (Modelo de Análise Visual Inclusiva)

## 1. Visão Geral e Objetivo

**Problema:** ferramentas automatizadas de auditoria de acessibilidade web (axe-core, Lighthouse) analisam apenas o DOM estático, sendo incapazes de detectar violações de acessibilidade que só se manifestam após a renderização visual da interface — por exemplo, contrastes insuficientes gerados dinamicamente via CSS/JS, ou alvos de toque com dimensões inadequadas após aplicação de estilos em runtime. No Brasil, menos de 1% dos sites operam em conformidade plena com as diretrizes WCAG, e desenvolvedores carecem de ferramentas que não só detectem, mas também proponham a correção do problema.

**Objetivo:** desenvolver e avaliar um sistema (MAVI) que integra visão computacional multimodal e inteligência artificial generativa para identificar barreiras de acessibilidade em interfaces web — incluindo aquelas que só emergem após a renderização — e propor automaticamente ao desenvolvedor trechos de código corrigidos, em formato de diff antes/depois.

**Público-alvo:** desenvolvedores web e equipes de QA que precisam auditar e corrigir problemas de acessibilidade (WCAG) em produtos digitais; secundariamente, a comunidade acadêmica de Interação Humano-Computador e Computação Visual, como contribuição científica avaliável por precisão/recall.

**Contexto acadêmico:** projeto de Iniciação Científica para o SIC 2026, com prazo de ~3 meses para protótipo funcional completo.

---

## 2. Escopo do MVP

### 2.1 Requisitos funcionais (User Stories)

**Captura e análise**
- Como usuário, quero submeter uma URL para que o sistema capture o HTML renderizado e um screenshot da página.
- Como usuário, quero que o sistema rode o axe-core sobre o DOM renderizado para detectar violações estruturais conhecidas.
- Como usuário, quero que o sistema envie o screenshot ao Gemini 2.5 Flash com um prompt estruturado, para detectar violações visuais que o axe-core não capta (ex: contraste dinâmico, alvos de toque).
- Como usuário, quero que os resultados do axe-core e da análise visual sejam cruzados e deduplicados em um único relatório de violações.

**Geração de correção**
- Como usuário, quero que, para cada violação detectada, o sistema envie o contexto (trecho HTML + descrição da violação) ao Llama 3.3 70B (via Groq) e receba um diff antes/depois com a correção sugerida.

**Visualização (Web UI)**
- Como usuário, quero ver um relatório navegável com: screenshot da página, lista de violações agrupadas por categoria WCAG, e o diff de correção para cada uma.
- Como usuário, quero poder expandir cada violação para ver o trecho de HTML original, a explicação da violação e o código corrigido lado a lado.

**Avaliação (modo batch/CLI)**
- Como pesquisador, quero rodar o pipeline sobre um conjunto de páginas de benchmark com violações previamente catalogadas.
- Como pesquisador, quero que o sistema calcule precisão e recall por categoria de violação WCAG, comparando as detecções do MAVI contra o gabarito do benchmark.
- Como pesquisador, quero exportar os resultados da avaliação em formato estruturado (JSON/CSV) para análise posterior.

**Benchmark**
- Como pesquisador, quero um conjunto inicial de páginas de teste (construídas manualmente e/ou coletadas) com violações WCAG catalogadas, cobrindo ao menos: contraste dinâmico, alvos de toque, e 1-2 categorias estruturais (ex: falta de `alt`, ordem de heading).

### 2.2 Fora do escopo do MVP (v1)
- Autenticação/multiusuário (sistema single-user, uso local ou por uma única instância)
- Suporte a páginas atrás de login/autenticação
- Parser de HTML estrutural próprio (usa axe-core no MVP; parser customizado fica para fases futuras)
- Análise de acessibilidade em PDFs, apps mobile nativos ou documentos não-web
- Correção automática aplicada diretamente no código-fonte do usuário (o sistema só sugere o diff, não aplica)
- Suporte a múltiplos idiomas de interface (MVP em português)
- Fila de processamento assíncrono robusta / múltiplos jobs simultâneos (execução síncrona por requisição é aceitável no MVP)

### 2.3 Requisitos não-funcionais
- **Custo zero de infraestrutura de IA:** uso exclusivo das camadas gratuitas do Gemini 2.5 Flash e do Groq (Llama 3.3 70B).
- **Sem dependência de GPU local:** toda inferência de IA é via API externa.
- **Reprodutibilidade científica:** o modo de avaliação batch deve ser determinístico o suficiente para permitir reexecução e comparação de resultados (registrar versão dos prompts, modelos e timestamp de cada rodada).
- **Tempo de resposta:** análise de uma única página (captura + axe-core + Gemini + Groq) deve completar em até ~30-60s, dado que depende de APIs externas.
- **Portabilidade:** deve rodar em ambiente de desenvolvimento local (não é requisito de deploy em produção/nuvem para o MVP acadêmico).

---

## 3. Stack & Arquitetura

### 3.1 Stack recomendada
- **Linguagem/runtime:** Node.js + TypeScript (ponta a ponta — evita ponte entre linguagens para injeção do axe-core)
- **Automação web:** Playwright (auto-wait robusto, captura fiel de estado pós-renderização, integração nativa via `@axe-core/playwright`)
- **Parser estrutural:** axe-core (via injeção no Playwright)
- **Visão computacional:** Gemini 2.5 Flash (API gratuita, chamada via `@google/generative-ai` ou REST)
- **Geração de código corrigido:** Llama 3.3 70B via Groq API (REST, SDK `groq-sdk`)
- **Backend/API:** Fastify (leve, TypeScript-first) ou Express
- **Frontend (dashboard):** React + Vite + Tailwind
- **Persistência:** SQLite (via Prisma ou Drizzle ORM) — suficiente para MVP local, armazena histórico de análises e resultados de benchmark
- **Testes:** Vitest

### 3.2 Organização da árvore de diretórios

```
mavi/
├── apps/
│   ├── api/                      # Backend Fastify
│   │   ├── src/
│   │   │   ├── capture/          # Playwright: screenshot + HTML renderizado
│   │   │   ├── analysis/
│   │   │   │   ├── axe/          # Camada estrutural (axe-core)
│   │   │   │   ├── vision/       # Camada visual (Gemini 2.5 Flash)
│   │   │   │   └── merge/        # Cruzamento e deduplicação de violações
│   │   │   ├── fix-generation/   # Geração de diff via Llama 3.3 70B (Groq)
│   │   │   ├── evaluation/       # Cálculo de precisão/recall sobre benchmark
│   │   │   ├── db/                # Schema e client Prisma/Drizzle
│   │   │   ├── routes/            # Endpoints HTTP (analyze, report, evaluate)
│   │   │   └── server.ts
│   │   └── package.json
│   ├── web/                      # Frontend React (dashboard)
│   │   ├── src/
│   │   │   ├── pages/             # Página de submissão de URL, relatório
│   │   │   ├── components/        # ViolationCard, DiffViewer, ScreenshotViewer
│   │   │   └── api/                # Client HTTP para apps/api
│   │   └── package.json
│   └── cli/                      # Modo batch/avaliação
│       ├── src/
│       │   └── run-benchmark.ts
│       └── package.json
├── packages/
│   └── shared/                   # Tipos TS compartilhados (Violation, Report, BenchmarkCase)
├── benchmark/
│   ├── pages/                    # Páginas de teste HTML com violações conhecidas
│   └── ground-truth/             # Gabarito (JSON) das violações catalogadas por página
├── prompts/
│   ├── vision-analysis.md        # Prompt estruturado para Gemini
│   └── fix-generation.md         # Prompt para Llama/Groq
└── README.md
```

### 3.3 Padrões de código esperados
- TypeScript estrito (`strict: true`), sem `any` implícito
- Tipos de domínio (`Violation`, `WcagCriterion`, `AnalysisReport`, `BenchmarkCase`) centralizados em `packages/shared`
- Cada camada de análise (axe, vision) implementa uma interface comum `AnalysisLayer` que retorna `Violation[]`, para facilitar adição futura de novas camadas (ex: parser customizado)
- Chamadas a APIs externas (Gemini, Groq) isoladas em módulos de client próprios, com retry/timeout configurável e mocks para testes
- Prompts versionados como arquivos separados (não hardcoded em string no código), para rastreabilidade científica

---

## 4. Modelo de Dados (Draft)

### Entidades principais

**Page**
- `id`, `url`, `capturedHtml`, `screenshotPath`, `createdAt`

**AnalysisRun**
- `id`, `pageId` (FK → Page), `status`, `startedAt`, `completedAt`, `modelVersions` (json: versões do Gemini/Llama/axe-core usadas)

**Violation**
- `id`, `analysisRunId` (FK → AnalysisRun), `wcagCriterion` (ex: "1.4.3 Contrast"), `sourceLayer` (enum: `axe` | `vision` | `both`), `description`, `htmlSnippet`, `severity`

**FixSuggestion**
- `id`, `violationId` (FK → Violation), `diffBefore`, `diffAfter`, `explanation`, `generatedAt`

**BenchmarkCase**
- `id`, `pageId` (FK → Page), `groundTruthViolations` (json: lista de violações esperadas com critério WCAG e localização)

**EvaluationResult**
- `id`, `benchmarkCaseId` (FK → BenchmarkCase), `analysisRunId` (FK → AnalysisRun), `truePositives`, `falsePositives`, `falseNegatives`, `precisionByCategory` (json), `recallByCategory` (json)

### Relacionamentos
- Uma `Page` pode ter várias `AnalysisRun` (reexecuções)
- Uma `AnalysisRun` tem várias `Violation`
- Cada `Violation` tem no máximo uma `FixSuggestion`
- Uma `BenchmarkCase` referencia uma `Page` e é usada para gerar um `EvaluationResult` a partir de uma `AnalysisRun`

---

## 5. Plano de Execução (TASKS.md)

Ver arquivo separado `TASKS.md`.

---

## 6. Roadmap pós-MVP (fases seguintes)

Sequência de evolução do MAVI **após** o MVP estar construído, testado e validado com as páginas de benchmark iniciais. Ordenada pela regra 80/20: prioriza os itens de maior retorno científico/produto com menor esforço de engenharia, deixando por último o que exige arquitetura nova ou tempo que não cabe no prazo de 3 meses.

Cada fase assume que a anterior está concluída e validada — não iniciar uma fase sem antes rodar o benchmark e confirmar que o MVP está estável.

### Fase A — Alto retorno, baixo/médio esforço (prioridade imediata pós-MVP)

Reaproveita quase 100% da infraestrutura já construída no MVP (captura, `AnalysisLayer`, prompts estruturados em JSON). É puramente extensão do que já existe, não arquitetura nova.

1. **Explicabilidade estruturada por violação** — cada `Violation` passa a carregar três evidências separadas: o que a camada visual observou, o que a camada estrutural (axe-core) encontrou, e o critério WCAG associado, além de um nível de confiança (`confirmado` | `provável` | `requer revisão humana`). Ajuste é majoritariamente no prompt do Gemini e no schema de dados.
2. **Localização visual com coordenadas** — pedir ao Gemini que retorne `bounding_box` (coordenadas) além do seletor CSS, e desenhar a marcação sobre o screenshot no dashboard. Resolve a dor de "qual elemento exatamente foi analisado".
3. **Avaliação com 4 configurações (A/B/C/D)** — reorganizar o modo de avaliação batch para rodar e comparar: (A) só axe-core, (B) só visão, (C) axe-core + visão, (D) completo com correção. Não exige código novo de análise, só reorganizar como o benchmark é executado e reportado — e é a espinha dorsal da seção de resultados do artigo.
4. **Verificação/sandbox pós-correção** — após gerar o diff, aplicar o patch em uma cópia isolada da página, re-capturar (reusa `capturePage`) e re-rodar as duas camadas de análise. Aceitar o fix só se a violação original sumir e nenhuma nova for introduzida. Vira a segunda hipótese científica do trabalho ("correção verificável" vs. geração sem validação).
5. **Contexto brasileiro** — mapear cada violação/fix para a Lei Brasileira de Inclusão (Lei nº 13.146/2015) e citar o e-MAG quando aplicável, com relatório e explicações em português. É curadoria de prompt/conteúdo, não engenharia nova.

### Fase B — Bom retorno, baixo esforço (se sobrar tempo dentro do prazo)

6. **Padrão ACT Rules Format (W3C)** — estruturar cada regra de detecção (objetivo, pré-condição, elemento-alvo, procedimento, resultado, critério WCAG associado) segundo o formato ACT. Fortalece reprodutibilidade e comparabilidade acadêmica; é reestruturação de metadados, não algoritmo novo.
7. **Perfis de usuário com deficiência** — para cada violação, gerar uma explicação adicional por perfil (baixa visão, cego, limitação motora, daltonismo, limitação cognitiva) via template/prompt. Reforça o argumento de impacto humano na introdução/discussão do artigo.

### Fase C — Retorno médio, esforço maior (só se o cronograma permitir após A e B)

8. **Múltiplos estados de interface** — explorador automático que captura estados além do carregamento inicial (modal aberto, dropdown, hover, foco, dark mode). Multiplica a superfície de teste (mais screenshots, mais chamadas de API, mais casos de benchmark), então só entra depois que a Fase A estiver validada.
9. **Teste de teclado automatizado + mapa de foco** — agente que percorre a página só com teclado (Tab/Enter/Esc), registra ordem de foco, foco preso ou ausente, e gera um mapa visual numerado sobre o screenshot.
10. **Comparação antes/depois de interação** — enviar pares de imagens (antes/depois de abrir menu, receber foco, etc.) ao Gemini com perguntas dirigidas (foco ficou visível? algo ficou escondido?). Depende da Fase C.8 já existir.

### Fase D — Fora do escopo do prazo atual (citar como "trabalhos futuros" no artigo)

Tecnicamente valiosas, mas cada uma isoladamente já representaria um projeto à parte — não cabem nos 3 meses e arriscam comprometer a entrega do MVP validado. Documentar como extensão futura é uma escolha academicamente legítima.

- Reconstrução completa de página com resolução de conflitos (AST) — engenharia não resolvida nem pelos concorrentes comerciais citados na análise de mercado.
- Multi-viewport (mobile/tablet/desktop) + zoom 200%/400%.
- Suporte framework-aware (correção direta em JSX/TSX de React/Vue/Angular).
- Dataset público + estudo com usuários reais/leitores de tela (NVDA/VoiceOver) — exige recrutamento de participantes.
- Integração CI/CD (GitHub Actions) e extensão de IDE.

### Critério de corte entre fases

Antes de avançar de uma fase para a próxima, validar: (1) o benchmark do MVP roda de ponta a ponta sem falhas; (2) as métricas de precisão/recall fazem sentido nas categorias já cobertas; (3) ainda resta tempo hábil no cronograma de 3 meses considerando escrita do artigo e preparação da apresentação. Se o tempo estiver apertado, priorizar a Fase A completa em vez de avançar parcialmente pelas fases B/C — os itens da Fase A têm o maior custo-benefício e são os que mais diferenciam o MAVI dos sistemas comerciais já existentes no mercado.
