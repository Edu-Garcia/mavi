# TASKS — MAVI (Plano de Execução)

Fatias verticais geradas a partir do `PRD.md` via `/to-tickets`. Cada ticket é demonstrável sozinho e cabe numa sessão de `/implement`.

**Frontier:** qualquer ticket cujo `Blocked by` já está concluído. Próximo: **2**.

Convenção: `- [ ]` aberto, `- [x]` feito. Marcar o ticket como feito só quando todos os critérios de aceite estiverem checados.

---

## MVP

### 1. Scaffold do workspace e vocabulário de domínio

**O que entrega:** o repositório typechecka, testa, e expõe os tipos `Page`, `AnalysisRun`, `Violation`, `FixSuggestion`, `BenchmarkCase`, `EvaluationResult` e a interface `AnalysisLayer`.

**Blocked by:** nenhum — pode começar imediatamente.

- [x] Workspace com `apps/api`, `apps/web`, `apps/cli` e tipos compartilhados, TypeScript estrito
- [x] Vitest rodando pelo menos um teste dummy verde
- [x] Tipos de domínio compilando e usáveis pelos apps
- [x] Exemplo de variáveis `GEMINI_API_KEY` e `GROQ_API_KEY` documentado, sem segredos reais

### 2. Capturar uma URL e persistir Page + AnalysisRun

**O que entrega:** dada uma URL (ou HTML local), o sistema devolve HTML renderizado e screenshot persistidos numa `AnalysisRun`. Verificável por API e teste, sem dashboard.

**Blocked by:** 1

- [ ] Captura pós-renderização (HTML + screenshot) de uma URL ou página local
- [ ] `Page` e `AnalysisRun` persistidos (SQLite)
- [ ] Erros de navegação (timeout, URL inválida, 4xx/5xx) retornam falha explícita, sem crash
- [ ] Teste com página HTML local prova a captura ponta a ponta (APIs externas mockadas se necessário)

### 3. Submeter URL e ver o screenshot no dashboard

**O que entrega:** o usuário cola uma URL, espera, e vê o screenshot da página capturada.

**Blocked by:** 2

- [ ] Página de submissão de URL no dashboard
- [ ] Após a captura, o relatório mostra o screenshot da `Page`
- [ ] Estado de carregamento visível durante a espera (até ~60s)
- [ ] Teste de componente ou e2e mínimo da submissão até o screenshot aparecer

### 4. Ver violações estruturais (axe-core) no relatório

**O que entrega:** no mesmo relatório, a lista de violações axe agrupadas por critério WCAG, com snippet HTML. Uma página sem `alt` produz uma `Violation` visível.

**Blocked by:** 3

- [ ] Camada `AnalysisLayer` axe-core gera `Violation[]` a partir do DOM renderizado
- [ ] Categorias axe mapeadas para critérios WCAG do domínio
- [ ] Relatório agrupa violações por categoria WCAG e mostra descrição, severidade e snippet
- [ ] Teste com página contendo `img` sem `alt` (e, se couber, ordem de heading) produz as `Violation` esperadas

### 5. Ver um diff de correção por violação

**O que entrega:** cada `Violation` tem uma `FixSuggestion` (antes/depois + explicação). O usuário expande o card e vê o diff.

**Blocked by:** 4

- [ ] Para cada `Violation`, o sistema gera uma `FixSuggestion` via Llama 3.3 70B (Groq)
- [ ] Prompt de correção versionado (não hardcoded)
- [ ] Dashboard mostra HTML original e código corrigido lado a lado, com explicação
- [ ] Testes com Groq mockado validam a estrutura do diff (antes, depois, explicação)

### 6. Ver violações visuais (Gemini) no relatório

**O que entrega:** violações que o axe não capta (contraste dinâmico, alvos de toque) aparecem no relatório com `sourceLayer` `vision`.

**Blocked by:** 4

- [ ] Camada `AnalysisLayer` visual envia o screenshot ao Gemini 2.5 Flash e devolve `Violation[]`
- [ ] Prompt de visão versionado, saída JSON com critério WCAG, descrição, localização aproximada, severidade
- [ ] Parse robusto da resposta (fallback se o JSON vier malformado)
- [ ] Testes com screenshot de contraste insuficiente (Gemini mockado) produzem `Violation` visíveis no relatório

### 7. Relatório único com violações deduplicadas

**O que entrega:** violações equivalentes de axe e visão viram uma só, com `sourceLayer` `both`. O usuário não vê duplicata do mesmo critério/elemento.

**Blocked by:** 4, 6

- [ ] `mergeViolations` deduplica por critério WCAG + elemento/região próxima
- [ ] `sourceLayer` marcado como `axe`, `vision` ou `both`
- [ ] Relatório e `ViolationCard` mostram a origem da detecção
- [ ] Testes cobrem: só axe, só visão, e detectada por ambos (uma única `Violation` no caso `both`)

### 8. Catálogo de benchmark com gabarito WCAG

**O que entrega:** 5–10 páginas de teste com gabarito (contraste dinâmico, alvos de toque, e 2–3 categorias estruturais) persistidas como `BenchmarkCase`.

**Blocked by:** 4

- [ ] Páginas de teste cobrindo contraste dinâmico, alvos de toque inadequados, falta de `alt` e ordem de heading
- [ ] Gabarito por página (critério WCAG + localização) associado a cada `BenchmarkCase`
- [ ] `BenchmarkCase` persistido a partir do catálogo

### 9. Avaliação batch com precisão/recall exportáveis

**O que entrega:** o pesquisador roda o CLI no catálogo, vê precisão/recall por categoria WCAG, e exporta JSON/CSV com versões de modelo/prompt e timestamp.

**Blocked by:** 7, 8

- [ ] CLI percorre todas as `BenchmarkCase` sem passar pela UI
- [ ] Precisão e recall por categoria WCAG, comparando `Violation[]` ao gabarito
- [ ] `EvaluationResult` persistido por rodada
- [ ] Export JSON/CSV; cada `AnalysisRun` registra versões de prompts, modelos e timestamp

### 10. README e validação numa página real

**O que entrega:** alguém clona, configura as chaves, analisa uma URL real e entende erros amigáveis na UI.

**Blocked by:** 5, 7

- [ ] README com setup, variáveis de ambiente e como rodar o benchmark
- [ ] Mensagens de erro amigáveis na UI (timeout, URL inválida, falha de API)
- [ ] Validação manual do fluxo completo com pelo menos uma página real fora do benchmark

---

# Pós-MVP (bloqueado)

> Só iniciar depois que o **ticket 9** estiver feito e o benchmark do MVP rodar de ponta a ponta. Racional e priorização: `PRD.md` seção 6.

Não recortar em fatias de implementação enquanto o MVP não estiver validado.

## Fase A — Alto retorno, baixo/médio esforço

### A1. Explicabilidade estruturada
- [ ] Estender `Violation` com evidências visual/estrutural e `confidenceLevel` (`confirmado` | `provável` | `requer_revisao`)
- [ ] Prompt de visão retorna essas evidências separadamente
- [ ] `ViolationCard` exibe as três evidências e o nível de confiança

### A2. Localização visual com coordenadas
- [ ] Gemini retorna `boundingBox` por violação
- [ ] Marcação desenhada sobre o screenshot no dashboard

### A3. Avaliação com 4 configurações (A/B/C/D)
- [ ] Benchmark compara só-axe, só-visão, axe+visão, e completo com correção
- [ ] Relatório comparativo (precisão/recall/F1 por configuração e categoria WCAG)

### A4. Verificação/sandbox pós-correção
- [ ] Aplicar o diff numa cópia isolada, re-capturar e re-analisar
- [ ] `verificationStatus` na `FixSuggestion` visível no dashboard

### A5. Contexto brasileiro
- [ ] Mapear critério WCAG → LBI (Lei nº 13.146/2015) e e-MAG quando aplicável
- [ ] Relatório e UI em português claro e consistente

## Fase B — Bom retorno, baixo esforço

### B1. Padrão ACT Rules Format
- [ ] Modelar regras no formato ACT e refletir no export

### B2. Perfis de usuário com deficiência
- [ ] Explicação por perfil (baixa visão, cego, limitação motora, daltonismo, limitação cognitiva) no `ViolationCard`

## Fase C — Retorno médio, esforço maior

### C1. Múltiplos estados de interface
- [ ] Capturar e analisar estados além do load inicial (modal, dropdown, hover, foco, dark mode)

### C2. Teste de teclado automatizado
- [ ] Mapa de foco numerado sobre o screenshot (Tab/Enter/Esc)

### C3. Comparação antes/depois de interação
- [ ] Pares de imagens ao Gemini com perguntas dirigidas de foco/mudança de estado (WCAG 2.2)

## Fase D — Não planejada para o prazo atual

Documentar como "trabalhos futuros" no artigo, sem tickets de implementação neste ciclo:
- Reconstrução completa de página com resolução de conflitos (AST)
- Multi-viewport + zoom 200%/400%
- Suporte framework-aware (correção em JSX/TSX)
- Dataset público + estudo com usuários reais/leitores de tela
- Integração CI/CD e extensão de IDE
