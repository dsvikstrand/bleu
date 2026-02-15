# State Machine Test Contract

Purpose: convert lifecycle semantics into deterministic evaluator checks.

## Lifecycle Under Test
`source_item -> imported_blueprint -> my_feed -> channel_candidate -> channel_published|channel_rejected`

## Scenario Matrix

### Valid Path Scenarios
1. Happy path publish
- Given valid source and all gate pass
- Expect terminal state `channel_published`

2. Personal-only reject path
- Given gate block on candidate
- Expect terminal state `channel_rejected`
- Expect My Feed item retained

3. Warn/manual review path
- Given warn result in selected mode
- Expect pending manual review outcome before publish/reject

### Invalid Transition Scenarios
1. Direct publish bypass
- Attempt `my_feed_published -> channel_published` without candidate evaluation
- Must fail with transition error

2. Reject to publish without re-eval
- Attempt `channel_rejected -> channel_published` without override/re-eval record
- Must fail

### Retry Scenarios
1. Transient ingestion failure
- timeout/network during normalization
- bounded retry should continue or end with explicit error state

2. Hard policy block
- safety/pii hard fail
- no automatic publish retry allowed

## Required Assertions
- each transition emits auditable status entry
- terminal states are unique and deterministic
- invalid transitions generate explicit reason code
- candidate failure does not auto-remove personal access

## Test Artifact Format (Example)
```json
{
  "scenario_id": "SM-REJECT-001",
  "start_state": "candidate_submitted",
  "inputs": {
    "gate_results": [
      { "gate_id": "quality", "outcome": "block", "reason_code": "QUALITY_TOO_SHALLOW" }
    ]
  },
  "expected": {
    "terminal_state": "channel_rejected",
    "my_feed_retained": true,
    "reason_codes": ["QUALITY_TOO_SHALLOW"]
  }
}
```
