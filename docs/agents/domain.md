# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo. The product and domain source of truth today is **`PRD.md`**, not `CONTEXT.md`.

## Before exploring, read these

- **`PRD.md`** at the repo root — vision, problem, MVP scope, out-of-scope, stack, architecture tree, data model, and pós-MVP roadmap. Treat it as the glossary and the product spec.
- **`TASKS.md`** at the repo root — execution plan only (what is done vs open). Work-tracking rules are in `docs/agents/issue-tracker.md`; do not treat TASKS as the domain model.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` do not exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates `CONTEXT.md` and ADRs lazily when terms or decisions actually get resolved.

If `CONTEXT.md` is created later, read it as well, but do not let it silently override `PRD.md`. Surface contradictions.

## File structure

Single-context (this repo):

```
/
├── PRD.md              ← product + domain source of truth
├── TASKS.md            ← execution plan (issue tracker)
├── docs/adr/           ← architecture decisions, created lazily
└── docs/agents/        ← this file and the issue-tracker mapping
```

A future monorepo layout (`apps/api`, `apps/web`, `apps/cli`, `packages/shared`) is specified in `PRD.md` but is not present yet. Stay single-context until a `CONTEXT-MAP.md` is explicitly introduced.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `PRD.md`. Current core terms include:

- `Page`, `AnalysisRun`, `Violation`, `FixSuggestion`, `BenchmarkCase`, `EvaluationResult`
- `AnalysisLayer` (axe, vision, merge)
- WCAG criteria as written in the PRD (e.g. contraste dinâmico, alvos de toque)

Don't drift to synonyms the PRD does not use (`bug` for `Violation`, `screenshot audit` for the vision layer, etc.).

If the concept you need isn't in the PRD yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling` and, if it is a product decision, for an update to `PRD.md`).

## Flag ADR conflicts

If your output contradicts an existing ADR or a decision already recorded in `PRD.md`, surface it explicitly rather than silently overriding:

> _Contradicts PRD.md §3.1 (stack) / ADR-NNNN — but worth reopening because…_
