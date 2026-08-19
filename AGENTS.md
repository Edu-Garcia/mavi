# AGENTS.md

Instructions for coding agents working in this repository.

## Git

**Commit e push só quando o usuário pedir explicitamente no chat.**

- Não faça `git commit` ao terminar uma tarefa, skill (`/implement`, code-review, etc.) ou sessão — a menos que o usuário tenha solicitado commit na conversa.
- Não faça `git push` (nem `git push -u`) sem pedido explícito no chat.
- Pode usar git localmente para inspecionar estado (`status`, `diff`, `log`) quando isso ajudar o trabalho.
- Se o trabalho estiver pronto e o usuário não pediu commit, diga que está pronto para revisão e pergunte se deseja commitar — não commite por conta própria.

## Agent skills

### Issue tracker

Work is tracked as checkbox items in `TASKS.md` (no GitHub Issues). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `PRD.md` is the product and domain source of truth; ADRs go in `docs/adr/` when they exist. See `docs/agents/domain.md`.
