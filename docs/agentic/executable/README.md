# Executable Docs Pack (`bleuV1` Phase 2)

This pack converts foundation docs into machine-actionable contracts for agent role loops.

## Scope
- Define deterministic planning and execution contracts.
- Remove product ambiguity from task generation and evaluation.
- Keep implementation as a later phase (no runtime behavior claims unless marked implemented).

## Role Flow (Sequential in Phase 2)
1. Planner
2. Implementer
3. Evaluator
4. Integrator

## Read Order
1. `docs/agentic/executable/decision-matrix.md`
2. `docs/agentic/executable/task-queue-scope.md`
3. `docs/agentic/executable/task-schema.md`
4. `docs/agentic/executable/task-artifact.schema.json`
5. `docs/agentic/executable/interface-contracts.md`
6. `docs/agentic/executable/schema-contracts.md`
7. `docs/agentic/executable/state-machine-tests.md`
8. `docs/agentic/executable/eval-harness.md`
9. `docs/agentic/executable/stop-inspect-policy.md`
10. `docs/agentic/executable/terminology-rules.md`
11. `docs/agentic/executable/role-contracts.md`
12. `docs/agentic/executable/review-gates.md`

## Phase 2.1 Decision Locks
- Explicit lifecycle state: `candidate_pending_manual_review`.
- Unified response envelope for spec endpoints (`ok`, `error_code`, `message`, `data`, optional `meta`).
- Auth split model (`user_required` vs `service_required`) and explicit idempotency mode per mutable endpoint.
- Evaluator default mode: `all_gates_run`.
- Code-change review baseline: `npm run lint` + `npm run test`, with conditional build triggers.

## Foundation Mapping
- north-star -> decision-matrix
- mvp-scope-contract -> task-queue-scope
- system-map -> interface-contracts
- data-contract -> schema-contracts
- lifecycle-and-state-machine -> state-machine-tests
- gate-policy -> eval-harness
- risk-register -> stop-inspect-policy
- glossary -> terminology-rules

## Spec-Only Marker
Any endpoint/schema/test contract in this pack is spec-only unless explicitly marked implemented in canonical runtime docs.
