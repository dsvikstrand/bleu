# Atomic Task Schema

Purpose: define a strict task artifact format for planner output and evaluator checks.

## Required Fields
- `task_id` (string, stable)
- `title` (string)
- `class` (enum: `docs_contract|interface_spec|implementation|evaluation|ops_observability`)
- `intent` (one sentence)
- `in_scope` (string array)
- `out_of_scope` (string array)
- `inputs` (doc/code references)
- `files_to_touch` (path array)
- `constraints` (string array)
- `dependencies` (task_id array)
- `acceptance_tests` (array of explicit checks)
- `rollback_plan` (explicit undo steps)
- `owner_role` (enum: `planner|implementer|evaluator|integrator`)
- `status` (enum: `todo|in_progress|blocked|done`)

## Optional Fields
- `risk_level` (`low|medium|high`)
- `checkpoint_required` (`none|cp1|cp2|cp3`)
- `notes`

## JSON Example (Planner Output)
```json
{
  "task_id": "BLEUV1-T042",
  "title": "Add candidate decision reason-code logging",
  "class": "implementation",
  "intent": "Persist gate reason codes for candidate publish decisions.",
  "in_scope": [
    "channel candidate decision logging",
    "evaluator-readable reason fields"
  ],
  "out_of_scope": [
    "new adapter support",
    "UI redesign"
  ],
  "inputs": [
    "docs/agentic/foundation/gate-policy.md",
    "docs/agentic/executable/eval-harness.md"
  ],
  "files_to_touch": [
    "server/index.ts",
    "docs/ops/yt2bp_runbook.md"
  ],
  "constraints": [
    "No change to promotion default mode",
    "Keep fail behavior personal-only on channel reject"
  ],
  "dependencies": ["BLEUV1-T038"],
  "acceptance_tests": [
    "unit test verifies reason_code persistence on block",
    "docs:refresh-check passes",
    "docs:link-check passes"
  ],
  "rollback_plan": [
    "revert decision log schema patch",
    "disable new logging write path via feature flag"
  ],
  "owner_role": "implementer",
  "status": "todo",
  "risk_level": "medium",
  "checkpoint_required": "cp2"
}
```

## Validation Rules
1. Missing required fields invalidates task.
2. `acceptance_tests` must contain at least one executable verification command or deterministic assertion.
3. `rollback_plan` must be explicit for `implementation` and `ops_observability` classes.
4. `checkpoint_required` must match stop policy triggers if risk class demands it.
