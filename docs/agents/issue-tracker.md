# Issue tracker: TASKS.md

Issues and the execution plan for this repo live in a single markdown file at the repo root: **`TASKS.md`**. There is no GitHub/GitLab remote yet and `.scratch/` is not used.

`TASKS.md` is the source of truth for work. Do not create GitHub issues, Linear tickets, or `.scratch/<feature>/` files unless the user explicitly asks to change trackers.

## Conventions

- One combined plan file: `TASKS.md` (not one file per ticket)
- Work is grouped by **Fase** headings (`## Fase 0 — …`, `## Fase 1 — …`, then pós-MVP `## Fase A/B/C/D`)
- Each item is a markdown checkbox:
  - `- [ ]` — open
  - `- [x]` — done
- Phases are ordered by technical dependency; later phases assume earlier ones are complete
- Product scope and rationale live in `PRD.md`; `TASKS.md` only tracks execution
- `PRD.md` section 5 points at `TASKS.md` — keep that link valid

When `/to-tickets` publishes tracer-bullet tickets, add them as checkbox items under the matching Fase (or a new Fase heading if none fits). Keep Portuguese, one actionable checkbox per item. Record blocking edges in the item text (e.g. `Blocked by: Fase 1`) rather than splitting into per-ticket files.

## When a skill says "publish to the issue tracker"

Edit `TASKS.md`. Add new work as checkbox items under the matching Fase heading (create a new Fase heading only if the work does not fit an existing one). Keep the same style as the rest of the file: Portuguese, one actionable checkbox per item, no extra metadata blocks.

Do **not**:

- Open a GitHub/GitLab issue
- Create `.scratch/` files
- Split `TASKS.md` into per-ticket files
- Duplicate an item that is already listed

If the new work is a product/scope change rather than an execution task, update `PRD.md` first, then add the corresponding checkboxes here.

## When a skill says "fetch the relevant ticket"

Read `TASKS.md`. Identify the Fase and the checkbox line that matches the request (by heading, wording, or the item the user pointed at). The user will normally name a phase (`Fase 3`) or paste/describe the item.

Status is the checkbox itself: `[ ]` is open, `[x]` is done. There is no separate `Status:` field and no triage labels.

## Wayfinding operations

Used by `/wayfinder`. This tracker is a single plan file, so map and children are sections inside `TASKS.md`, not separate files.

- **Map**: `TASKS.md` as a whole — the Fase headings are the map. Notes and sequencing already live in the heading order and in `PRD.md` section 6 for pós-MVP rationale.
- **Child ticket**: one checkbox item under a Fase heading. Treat the item text as the ticket body.
- **Blocking**: implicit — a Fase is blocked until previous Fases are complete (all their boxes checked), as stated at the top of `TASKS.md`. Pós-MVP Fases A–D are blocked until Fases 0–11 are validated with the benchmark.
- **Frontier**: the first unchecked `- [ ]` in the earliest incomplete Fase.
- **Claim**: not represented as a field. The agent working an item is implied by the current session; do not add `Status: claimed` lines.
- **Resolve**: check the box (`- [x]`). If a decision needs to be recorded beyond the checkbox, add a short note under that Fase or in `docs/adr/` — do not invent a parallel ticket file.
