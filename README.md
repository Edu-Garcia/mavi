# MAVI — Modelo de Análise Visual Inclusiva

Sistema de auditoria de acessibilidade web que combina análise estrutural (axe-core) e visão computacional (Gemini) para detectar violações WCAG e sugerir correções.

**Estado atual (MVP tickets 1–3):** captura de URL/HTML local (Playwright) com persistência SQLite, e dashboard onde você cola uma URL e vê o screenshot. Análise axe/Gemini, diffs de correção e benchmark ainda não estão no código.

## Pré-requisitos

- Node.js 22 ou superior
- npm 11 ou superior
- Docker Desktop (opcional, para subir web + API em containers)

## Setup

```bash
npm install
cp .env.example .env
```

Para o fluxo atual (captura + screenshot no dashboard), as chaves de IA podem ficar vazias. Elas entram nas próximas fatias:

- `GEMINI_API_KEY` — Gemini 2.5 Flash (camada visual)
- `GROQ_API_KEY` — Llama 3.3 70B via Groq (sugestão de correção)

Não commite o arquivo `.env`.

Variáveis úteis no `.env` / runtime:

| Variável | Padrão | Uso |
|----------|--------|-----|
| `PORT` | `3000` | Porta da API |
| `DATABASE_PATH` | `./data/mavi.db` | SQLite |
| `SCREENSHOT_DIR` | `./data/screenshots` | PNGs capturados |
| `VITE_API_URL` | `http://localhost:3000` | Base URL que o dashboard chama |

## Rodar em desenvolvimento (host)

Em dois terminais:

```bash
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173
```

1. Abra o dashboard em http://localhost:5173
2. Cole uma URL `http(s)` e clique em **Analisar**
3. Aguarde o estado “Analisando…” (captura pode levar até ~60s)
4. O relatório mostra o screenshot da `Page` capturada

A API precisa estar no ar; o web usa `VITE_API_URL` (padrão `http://localhost:3000`).

## Docker

```bash
docker compose up --build
# ou: npm run docker:up
```

- Dashboard: http://localhost:5173
- API: http://localhost:3000
- Volume persistente para SQLite/screenshots em `data/` (no container)

```bash
docker compose down
# ou: npm run docker:down
```

O código é montado como volume; a imagem já inclui dependências de sistema do Chromium/Playwright.

## API (o que existe hoje)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check |
| `POST` | `/analyze` | Body `{ "url": "<http(s) ou caminho HTML local>" }` → `Page` + `AnalysisRun` |
| `GET` | `/pages/:pageId/screenshot` | PNG da `Page` |

Exemplo:

```bash
curl -s -X POST http://localhost:3000/analyze \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://example.com\"}"
```

Resposta de sucesso inclui `page.id`; o screenshot fica em `/pages/<page.id>/screenshot`.

Falhas de captura (URL inválida, timeout, HTTP 4xx/5xx no alvo) voltam como JSON `{ "error": { "reason", "message", ... } }` sem derrubar o processo.

## Scripts

```bash
npm test          # Vitest em todos os workspaces
npm run typecheck
npm run dev:api
npm run dev:web
npm run docker:up
npm run docker:down
```

## Próximos passos (plano)

Ver `TASKS.md`. Próximo ticket: **4** — violações estruturais (axe-core) no relatório. Depois: correções (Groq), visão (Gemini), merge, benchmark e CLI.
