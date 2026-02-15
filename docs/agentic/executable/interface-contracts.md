# Interface Contracts (Spec-Only)

These are planned interfaces for implementation phase and not guaranteed as current runtime endpoints.

## Source Subscription Interfaces
### POST `/api/source-subscriptions`
Request
```json
{
  "source_type": "youtube",
  "source_channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "mode": "selected"
}
```
Response
```json
{
  "ok": true,
  "subscription_id": "sub_123",
  "mode": "selected"
}
```
Errors
- `INVALID_SOURCE`
- `DUPLICATE_SUBSCRIPTION`
- `AUTH_REQUIRED`

### GET `/api/source-subscriptions`
Response
```json
{
  "ok": true,
  "items": [
    {
      "subscription_id": "sub_123",
      "source_type": "youtube",
      "source_channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "mode": "selected",
      "is_active": true
    }
  ]
}
```

### DELETE `/api/source-subscriptions/:id`
Response
```json
{
  "ok": true,
  "deleted": true
}
```

## Ingestion Job Interfaces
### POST `/api/ingestion/jobs/trigger`
Request
```json
{
  "subscription_id": "sub_123",
  "limit": 10
}
```
Response
```json
{
  "ok": true,
  "job_id": "job_456",
  "status": "queued"
}
```

### GET `/api/ingestion/jobs/:jobId`
Response
```json
{
  "ok": true,
  "job_id": "job_456",
  "status": "running",
  "processed": 3,
  "failed": 0
}
```

## Channel Candidate Interfaces
### POST `/api/channel-candidates/:id/evaluate`
Response
```json
{
  "ok": true,
  "candidate_id": "cand_789",
  "decision": "failed",
  "reasons": ["FIT_LOW_CONFIDENCE"]
}
```

### POST `/api/channel-candidates/:id/publish`
Response
```json
{
  "ok": true,
  "candidate_id": "cand_789",
  "published": true,
  "channel_slug": "skincare"
}
```

### POST `/api/channel-candidates/:id/reject`
Response
```json
{
  "ok": true,
  "candidate_id": "cand_789",
  "rejected": true,
  "reason_code": "QUALITY_TOO_SHALLOW"
}
```

## Interface Compatibility Rules
1. Additive evolution preferred for response payloads.
2. Error code enums require docs update in same change.
3. Breaking changes require versioning or explicit migration plan.
