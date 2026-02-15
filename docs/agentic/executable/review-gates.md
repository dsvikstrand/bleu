# Review Gates (Integration Minimum)

Purpose: define non-negotiable checks before integration.

## Mandatory Gates
1. Docs governance
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

2. Task acceptance
- all `acceptance_tests` listed in task artifact pass

3. Contract traceability
- change references at least one foundation and one executable contract where relevant

4. Policy compliance
- no violation of decision matrix defaults
- no checkpoint-bypass for required triggers

## Conditional Gates
- Unit/integration tests when code behavior changes
- Smoke checks for ingest/gate pipeline when backend path changes
- Metrics script sanity when telemetry interfaces change

## Fail Conditions
- missing rollback for required task classes
- unresolved blocking risk from risk-register owner
- ambiguous terminology violating terminology-rules

## Integrator Output Format
- `task_id`
- gate result summary
- checkpoint status (`not_required|cp1_ok|cp2_ok|cp3_ok`)
- merge decision (`approved|blocked`)
- blocker list (if blocked)
