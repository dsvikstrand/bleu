# Project - bleuV1 MVP Foundation

Status: `active`

## Goal
Produce decision-complete docs so multi-agent implementation can run with minimal human invention.

## Phase Breakdown
1. Phase 1 - Foundation contracts (`completed`)
2. Phase 2 - Executable contracts (`active`)
3. Phase 3 - Automation wiring (`planned`)

## Locked Defaults
1. YouTube-only adapter scope for MVP.
2. My Feed default visibility is personal/private until channel promotion.
3. Channel promotion default mode is selected/manual approve.
4. User value-add is insight/remix on imported blueprints; no standalone free-form post model in MVP core.
5. Low-confidence channel candidates are blocked from channel and retained in My Feed.
6. Stop-and-inspect checkpoints are capped at three per milestone.
7. Orchestration control plane default is CLI-first (`codex exec`) + GitHub Actions.

## Phase 1 Completion Evidence
- Foundation files:
  - `docs/agentic/foundation/north-star.md`
  - `docs/agentic/foundation/mvp-scope-contract.md`
  - `docs/agentic/foundation/system-map.md`
  - `docs/agentic/foundation/lifecycle-and-state-machine.md`
  - `docs/agentic/foundation/data-contract.md`
  - `docs/agentic/foundation/gate-policy.md`
  - `docs/agentic/foundation/risk-register.md`
  - `docs/agentic/foundation/glossary.md`
- Navigation/governance updates:
  - `docs/README.md`
  - `docs/_freshness_map.json`

## Phase 2 Deliverables And Done Criteria

### E1 - Executable entrypoint
- File: `docs/agentic/executable/README.md`
- Done when:
  1. Executable read order is explicit.
  2. Foundation -> executable mapping is explicit.
  3. Role ownership is explicit.

### E2 - Decision matrix
- File: `docs/agentic/executable/decision-matrix.md`
- Done when:
  1. Defaults and refusal rules are explicit.
  2. Override authority model is explicit.
  3. Escalation triggers are explicit.

### E3 - Task queue contract
- Files:
  - `docs/agentic/executable/task-queue-scope.md`
  - `docs/agentic/executable/task-schema.md`
- Done when:
  1. Task classes and decomposition rules are explicit.
  2. Atomic task schema includes acceptance tests and rollback requirements.
  3. JSON example is valid and complete.

### E4 - Interface and schema contracts
- Files:
  - `docs/agentic/executable/interface-contracts.md`
  - `docs/agentic/executable/schema-contracts.md`
- Done when:
  1. Planned interfaces are documented as spec-only.
  2. Entity invariants, idempotency, and cache contracts are explicit.
  3. Compatibility and rollback constraints are explicit.

### E5 - State and eval execution contracts
- Files:
  - `docs/agentic/executable/state-machine-tests.md`
  - `docs/agentic/executable/eval-harness.md`
- Done when:
  1. Lifecycle scenarios include valid/invalid/retry/terminal tests.
  2. Gate order, threshold behavior, and fail-closed rules are explicit.
  3. Decision payload contract is explicit.

### E6 - Governance and language enforcement
- Files:
  - `docs/agentic/executable/stop-inspect-policy.md`
  - `docs/agentic/executable/terminology-rules.md`
  - `docs/agentic/executable/review-gates.md`
- Done when:
  1. Exactly three mandatory checkpoint classes are defined.
  2. Terminology lint-style rules prevent identity drift.
  3. Integration minimum gates are explicit.

### E7 - Role handoff contracts
- File: `docs/agentic/executable/role-contracts.md`
- Done when:
  1. Planner/Implementer/Evaluator/Integrator I/O contracts are explicit.
  2. Must-not constraints are explicit per role.
  3. Handoff artifact minimum is explicit.

### E8 - Canonical and freshness wiring
- Files:
  - `docs/agentic/README.md`
  - `docs/README.md`
  - `docs/_freshness_map.json`
- Done when:
  1. Canonical read order includes executable pack.
  2. Freshness map requires executable docs where relevant.

## Validation Checklist (Phase 2)
- `npm run docs:refresh-check -- --json` passes.
- `npm run docs:link-check` passes.
- Contradiction audit passes: no active docs reintroduce library-first or standalone-post-first identity.
- Completeness audit passes: locked defaults appear in canonical + foundation + executable docs.
- Traceability audit passes: each foundation doc has at least one executable contract mapping.

## Deferred Items (Phase 3+)
- `codex exec` orchestration scripts and role runner wrappers.
- CI workflow implementation for evaluator and integrator gates.
- Automated checkpoint enforcement.
