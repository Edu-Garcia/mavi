# MAVI — Modelo de Análise Visual Inclusiva

Sistema de auditoria de acessibilidade web que combina análise estrutural (axe-core) e visão computacional (Gemini) para detectar violações WCAG e sugerir correções.

## Pré-requisitos

- Node.js 22 ou superior
- npm 11 ou superior
- Docker Desktop (opcional, para subir web + API em containers)

## Setup

```bash
npm install
cp .env.example .env
```

Edite `.env` com as chaves das APIs (camadas gratuitas):

- `GEMINI_API_KEY` — Google AI Studio, usado pelo Gemini 2.5 Flash na camada visual
- `GROQ_API_KEY` — Groq Cloud, usado pelo Llama 3.3 70B na geração de correções

Não commite o arquivo `.env`.

## Docker (desenvolvimento local)

Sobe o dashboard (porta **5173**) e a API de desenvolvimento (porta **3000**), com volume persistente para SQLite em `data/`:

```bash
docker compose up --build
# ou
npm run docker:up
```

Endpoints:

- Dashboard: http://localhost:5173
- API health: http://localhost:3000/health

Parar:

```bash
docker compose down
# ou
npm run docker:down
```

O código é montado como volume; alterações locais refletem nos containers. A imagem já inclui dependências de sistema para Chromium/Playwright (captura na task 2).

## Scripts

```bash
npm test        # Vitest (workspaces)
npm run typecheck
npm run dev:web # dashboard sem Docker
npm run dev:api # API dev (health) sem Docker
```

O dashboard web (`apps/web`) também sobe com `npm run dev --workspace=@mavi/web`. API, captura e benchmark completos entram nos tickets seguintes.
