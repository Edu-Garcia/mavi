# MAVI — Modelo de Análise Visual Inclusiva

Sistema de auditoria de acessibilidade web que combina análise estrutural (axe-core) e visão computacional (Gemini) para detectar violações WCAG e sugerir correções.

## Pré-requisitos

- Node.js 22 ou superior
- npm 11 ou superior

## Setup

```bash
npm install
cp .env.example .env
```

Edite `.env` com as chaves das APIs (camadas gratuitas):

- `GEMINI_API_KEY` — Google AI Studio, usado pelo Gemini 2.5 Flash na camada visual
- `GROQ_API_KEY` — Groq Cloud, usado pelo Llama 3.3 70B na geração de correções

Não commite o arquivo `.env`.

## Scripts

```bash
npm test        # Vitest (workspaces)
npm run typecheck
```

O dashboard web (`apps/web`) sobe com `npm run dev --workspace=@mavi/web`. API, captura e benchmark entram nos tickets seguintes.
