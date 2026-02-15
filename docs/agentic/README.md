# Agentic Docs Pack (`bleuV1`)

This folder is the control surface for moving from manual planning to multi-agent execution.

## Intent
- Phase 1 (foundation): decision-locked descriptive contracts.
- Phase 2 (executable): machine-actionable role/task/eval contracts.
- Phase 3 (automation): scripted orchestration and CI automation on top of Phase 2.

## Read Order (Foundation)
1. `docs/agentic/foundation/north-star.md`
2. `docs/agentic/foundation/mvp-scope-contract.md`
3. `docs/agentic/foundation/system-map.md`
4. `docs/agentic/foundation/lifecycle-and-state-machine.md`
5. `docs/agentic/foundation/data-contract.md`
6. `docs/agentic/foundation/gate-policy.md`
7. `docs/agentic/foundation/risk-register.md`
8. `docs/agentic/foundation/glossary.md`

## Read Order (Executable)
1. `docs/agentic/executable/decision-matrix.md`
2. `docs/agentic/executable/task-queue-scope.md`
3. `docs/agentic/executable/task-schema.md`
4. `docs/agentic/executable/interface-contracts.md`
5. `docs/agentic/executable/schema-contracts.md`
6. `docs/agentic/executable/state-machine-tests.md`
7. `docs/agentic/executable/eval-harness.md`
8. `docs/agentic/executable/stop-inspect-policy.md`
9. `docs/agentic/executable/terminology-rules.md`
10. `docs/agentic/executable/role-contracts.md`
11. `docs/agentic/executable/review-gates.md`

## Foundation -> Executable Mapping
- `north-star.md` -> `decision-matrix.md`
- `mvp-scope-contract.md` -> `task-queue-scope.md`
- `system-map.md` -> `interface-contracts.md`
- `data-contract.md` -> `schema-contracts.md`
- `lifecycle-and-state-machine.md` -> `state-machine-tests.md`
- `gate-policy.md` -> `eval-harness.md`
- `risk-register.md` -> `stop-inspect-policy.md`
- `glossary.md` -> `terminology-rules.md`

## Role Ownership
- Planner: decision matrix + queue scope + task schema.
- Implementer: interface/schema/state contracts.
- Evaluator: eval harness + review gates.
- Integrator: stop-inspect policy + release gate decisions.

## Guardrails
- Canonical docs remain authoritative for runtime state:
  - `docs/app/product-spec.md`
  - `docs/architecture.md`
  - `docs/exec-plans/index.md`
- Active agentic docs are contracts, not optional guidance.
- Any spec-only interfaces must be explicitly labeled as not yet implemented.
