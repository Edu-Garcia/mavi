# MAVI — Modelo de Análise Visual Inclusiva

Sistema de auditoria de acessibilidade web que combina análise estrutural (axe-core) e visão computacional (Gemini) para detectar violações WCAG, deduplicar resultados e sugerir correções (Llama 3.3 via Groq).

**MVP:** captura de URL → screenshot + HTML → axe + visão → relatório unificado com diffs de correção; CLI de benchmark com precisão/recall exportáveis.

## Pré-requisitos

- Node.js 22 ou superior
- npm 11 ou superior
- Docker Desktop (opcional, para subir web + API em containers)
- Contas com API key gratuita:
  - [Google AI Studio](https://aistudio.google.com/) — `GEMINI_API_KEY` (camada visual)
  - [Groq](https://console.groq.com/) — `GROQ_API_KEY` (sugestão de correção)

Sem as chaves, a captura e o axe-core ainda funcionam; visão e correções ficam vazias. O benchmark CLI exige `GEMINI_API_KEY`.

## Setup

```bash
npm install
cp .env.example .env
```

Preencha no `.env`:

```bash
GEMINI_API_KEY=sua-chave-gemini
GROQ_API_KEY=sua-chave-groq
```

Não commite o arquivo `.env`.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|----------|--------|-----|
| `GEMINI_API_KEY` | _(vazio)_ | Gemini 3.8 Flash — violações visuais |
| `GROQ_API_KEY` | _(vazio)_ | Llama 3.3 70B via Groq — diffs de correção |
| `PORT` | `3000` | Porta da API |
| `DATABASE_PATH` | `./data/mavi.db` | SQLite (análises e páginas) |
| `SCREENSHOT_DIR` | `./data/screenshots` | PNGs capturados |
| `VITE_API_URL` | `http://localhost:3000` | Base URL que o dashboard chama |

## Rodar em desenvolvimento (host)

Em dois terminais:

```bash
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173
```

1. Abra o dashboard em http://localhost:5173
2. Cole uma URL `http(s)` e escolha o modo:
   - **Com sugestões de código** — análise + diffs via Groq
   - **Auditoria (sem correções de código)** — só violações; depois use **Exportar relatório HTML**
3. Clique em **Analisar** e aguarde “Analisando…” (pode levar até ~60s)
4. O relatório mostra o screenshot e as violações agrupadas por WCAG; no modo com correção, cada card pode expandir o diff

A API precisa estar no ar; o web usa `VITE_API_URL` (padrão `http://localhost:3000`).

O HTML exportado é autônomo (screenshot embutido). Para PDF: abra o arquivo no navegador e use Imprimir → salvar como PDF.

### Erros na UI

Falhas comuns aparecem como mensagens claras no dashboard (não como stack traces):

- **URL inválida** — use um endereço `http(s)` completo
- **Timeout** — a página demorou demais para carregar
- **Página inacessível** — erro HTTP ou falha de navegação
- **API indisponível** — o servidor MAVI não está em execução ou não respondeu

## Benchmark (CLI)

Percorre o catálogo em `benchmark/` (páginas HTML + gabarito WCAG), calcula precisão/recall por categoria e exporta JSON/CSV — sem passar pela UI.

```bash
# Com GEMINI_API_KEY no ambiente (ou no .env carregado pelo shell)
npm run benchmark
```

Flags opcionais (passadas ao CLI):

| Flag | Padrão | Descrição |
|------|--------|-----------|
| `--db` | `data/benchmark.sqlite` | SQLite da rodada |
| `--out` | `benchmark/results` | Pasta do export JSON/CSV |
| `--catalog` | `benchmark/` na raiz do repo | Raiz com `pages/` e `ground-truth/` |

Exemplo:

```bash
npm run benchmark -- --db data/benchmark.sqlite --out benchmark/results
```

O relatório no terminal lista precisão/recall por categoria; os arquivos exportados incluem versões de modelos/prompts e timestamp.

## Docker

```bash
docker compose up --build
# ou: npm run docker:up
```

- Dashboard: http://localhost:5173
- API: http://localhost:3000
- Volume persistente para SQLite/screenshots em `data/`

Passe as chaves via `.env` na raiz (o compose as lê).

```bash
docker compose down
# ou: npm run docker:down
```

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check |
| `POST` | `/analyze` | Body `{ "url": "...", "mode": "fix" \| "audit" }` → `Page`, `AnalysisRun`, `Violation[]`, `FixSuggestion[]` (`audit` pula Groq) |
| `GET` | `/pages/:pageId/screenshot` | PNG da `Page` |

Exemplo:

```bash
curl -s -X POST http://localhost:3000/analyze \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://example.com\"}"
```

Falhas de captura voltam como JSON `{ "error": { "reason", "message", ... } }` sem derrubar o processo.

## Scripts

```bash
npm test          # Vitest em todos os workspaces
npm run typecheck
npm run dev:api
npm run dev:web
npm run benchmark
npm run docker:up
npm run docker:down
```

## Próximos passos

O MVP está coberto em `TASKS.md`. Trabalho pós-MVP (explicabilidade, bounding boxes, A/B de configurações, etc.) está listado nas fases A–D do mesmo arquivo.
