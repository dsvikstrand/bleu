# Documentation Index (Canonical)

This folder is the source of truth for product, architecture, planning, and operations.

## Read Order For New Engineers/Models
1. `docs/architecture.md`
2. `docs/app/product-spec.md`
3. `docs/agentic/README.md`
4. `docs/agentic/foundation/north-star.md`
5. `docs/agentic/executable/README.md`
6. `docs/exec-plans/index.md`
7. `docs/exec-plans/active/bleuv1-source-first-program.md`
8. `docs/ops/yt2bp_runbook.md`

## Canonical Documents
- Architecture: `docs/architecture.md`
- Product behavior/spec: `docs/app/product-spec.md`
- Execution registry (active/completed): `docs/exec-plans/index.md`
- Program direction (`bleuV1`): `docs/exec-plans/active/bleuv1-source-first-program.md`
- Active MVP project: `docs/exec-plans/active/project-bleuv1-mvp-foundation.md`
- Agentic foundation pack: `docs/agentic/foundation/`
- Agentic executable pack: `docs/agentic/executable/`
- YT2BP API contract (adapter v0): `docs/product-specs/yt2bp_v0_contract.md`
- YT2BP runbook: `docs/ops/yt2bp_runbook.md`
- ASS design spec (seed/eval system): `docs/design-docs/seed_ass_spec.md`

## Folder Map
- `docs/app/` product-level behavior and user flow docs
- `docs/agentic/` foundation and executable docs for agentic execution
- `docs/architecture.md` system topology and invariants
- `docs/design-docs/` technical design + diagrams
- `docs/exec-plans/active/` currently active plans/program docs
- `docs/exec-plans/completed/` closed plans and closure notes
- `docs/ops/` runbooks and operational procedures
- `docs/product-specs/` product contracts and scoped feature plans
- `docs/references/` stable reference material
- `docs/schemas/` schema contracts

## Governance Rules
- Do not reintroduce moved/deprecated stub docs.
- Use canonical paths only (listed above).
- Keep active/completed status in sync via `docs/exec-plans/index.md`.
- When code changes match freshness rules, run:
  - `npm run docs:refresh-check -- --json`
  - `npm run docs:link-check`

## Freshness System
- Mapping file: `docs/_freshness_map.json`
- Checker: `npm run docs:refresh-check`
- Output fields:
  - `affected_docs`
  - `missing_updates`
  - `suggested_sections`
  - `status`
