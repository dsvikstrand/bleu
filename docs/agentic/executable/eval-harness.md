# Eval Harness Contract (Executable Spec)

Purpose: define deterministic evaluation behavior for channel candidate decisions.

## Gate Execution Order
1. `channel_fit`
2. `quality`
3. `safety`
4. `pii`

Rule:
- hard `block` may short-circuit publish path, but all run mode can be enabled for richer audit evidence.

## Outcome Semantics
- `pass`: no block contribution.
- `warn`: non-terminal caution; selected mode routes to manual review.
- `block`: terminal reject for channel publish.

## Threshold Policies
- low-confidence in `channel_fit` or `quality` -> block by default in MVP.
- safety warn treated as block until override policy explicitly changes.
- pii warn treated as block until redaction/remix resolves issue.

## Required Decision Payload
```json
{
  "candidate_id": "cand_789",
  "policy_version": "bleuv1-gate-policy-v1.0",
  "decision": "rejected",
  "gates": [
    {
      "gate_id": "quality",
      "outcome": "block",
      "reason_code": "QUALITY_TOO_SHALLOW",
      "score": 0.42,
      "method_version": "quality-v0"
    }
  ]
}
```

## Fail-Closed Rules
1. Missing policy config for mandatory gate -> reject with `POLICY_CONFIG_MISSING`.
2. Evaluator provider failure for safety/pii -> reject with fail-closed reason.
3. Timeout in mandatory gate -> reject with `EVAL_TIMEOUT` unless explicit safe fallback is approved.

## Evidence Requirements
- each gate writes method/version metadata
- decision includes normalized reason codes
- evaluator stores audit timestamp and candidate id

## Evaluator Pass Criteria
1. Decision payload schema valid.
2. Reason codes are in taxonomy.
3. Outcome complies with policy class behavior.
4. Lifecycle result matches state-machine contract.

## Not Implemented Yet
This harness defines execution behavior for build phase; runtime parity must be verified per task.
