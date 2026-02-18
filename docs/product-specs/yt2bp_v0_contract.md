# YT2BP v0 Contract

## Scope
- Endpoint: `POST /api/youtube-to-blueprint`
- Version: `v0`
- Stability rule: v0 changes must be additive or versioned.
- 2026-02-12 note: Project 2 Step 1 feed-summary hygiene changes are UI-only and do not alter this contract.
- 2026-02-12 note: Project 2 Step 2 feed-row shell changes are UI-only and do not alter this contract.
- 2026-02-12 note: Project 2 one-row full-tag rendering changes are UI-only and do not alter this contract.
- 2026-02-12 note: Project 2 one-row tag measurement hotfix is UI-only and does not alter this contract.
- 2026-02-13 note: Project 2 Step 3 wall-to-wall shell tightening and Wall/Explore comment counters are UI-only and do not alter this contract.
- 2026-02-13 note: Explore tag-click lookup hotfix (search-first behavior on feed cards) is UI-only and does not alter this contract.
- 2026-02-13 note: Project 3 Step 1 channel join-state UI wiring and filter-only chip behavior are frontend-only and do not alter this contract.
- 2026-02-13 note: Channels IA/routing phase (`/channels`, `/b/:channelSlug`, curated slug guards, `/tags` redirect) is UI-only and does not alter this contract.
- 2026-02-13 note: Channel-scoped `+ Create` flow routes to `/youtube?channel=<slug>&intent=post` and blocks public publish unless channel is valid and joined; this is UI/product behavior and does not alter this endpoint contract.
- 2026-02-13 note: App-wide wall-to-wall layout migration (Run 1) updates YouTube page framing to a minimal document-like layout; UI-only and does not alter this contract.
- 2026-02-17 note: dual-feed rollout moved post-generation behavior to personal-first (`/my-feed`) with channel submission as a separate candidate lifecycle; this does not alter the YT2BP request/response envelope.
- 2026-02-17 note: optional AI review/banner are now executed as separate post-generation steps in UI (`/api/analyze-blueprint` and `/api/generate-banner`) so core YT2BP latency is lower; this does not alter the YT2BP envelope.
- 2026-02-18 note: subscription ingestion (`/api/source-subscriptions*`, `/api/ingestion/jobs/trigger`) and pending-card accept/skip (`/api/my-feed/items/:id/accept|skip`) are separate flows and do not alter this endpoint envelope.
- 2026-02-18 note: subscription create path now uses auto-only behavior (incoming `mode` is compatibility-only and treated as `auto`); first subscribe sets checkpoint and inserts a `subscription_notice` feed card. This remains outside this endpoint envelope.
- 2026-02-18 note: debug simulation endpoint (`/api/debug/subscriptions/:id/simulate-new-uploads`) is env-gated (`ENABLE_DEBUG_ENDPOINTS`) and service-auth only (`x-service-token`, no user bearer required); this also remains outside the YT2BP envelope.
- 2026-02-18 note: YouTube subscription channel resolution now includes `browseId` fallback parsing for handle pages where direct `channelId` metadata is unavailable.
- 2026-02-17 note: ingestion reliability visibility adds service-auth endpoint `GET /api/ingestion/jobs/latest`; this is an ops path and does not alter the YT2BP envelope.
- 2026-02-17 note: auth-only YouTube discovery endpoint `GET /api/youtube-search` is additive and does not alter the YT2BP envelope.
- 2026-02-17 note: auth-only YouTube channel discovery endpoint `GET /api/youtube-channel-search` is additive and does not alter the YT2BP envelope.
- 2026-02-17 note: `GET /api/source-subscriptions` now includes optional `source_channel_avatar_url` read-time enrichment for UI; this remains outside the YT2BP envelope.
- 2026-02-17 note: subscription auto-ingest generation now enables review-by-default while keeping banner disabled; this remains outside the YT2BP endpoint envelope.
- 2026-02-18 note: subscription notice cards may use `source_items.metadata.channel_banner_url`, and unsubscribe now removes user-scoped notice rows from My Feed; this remains outside the YT2BP endpoint envelope.
- 2026-02-18 note: async auto-banner queue endpoints (`/api/auto-banner/jobs/trigger`, `/api/auto-banner/jobs/latest`) and cap fallback policy are additive ops paths and remain outside the YT2BP endpoint envelope.
- 2026-02-18 note: Search->YouTube route handoff now includes channel context (`channel_id`, `channel_title`, `channel_url`) so save-to-feed can persist source channel metadata; YT2BP endpoint envelope remains unchanged.

## Request
```json
{
  "video_url": "https://www.youtube.com/watch?v=...",
  "generate_review": false,
  "generate_banner": false,
  "source": "youtube_mvp"
}
```

### Request constraints
- Single YouTube clip only (`youtube.com/watch` or `youtu.be`).
- Playlist URLs are rejected.

## Success response
```json
{
  "ok": true,
  "run_id": "yt2bp-...",
  "draft": {
    "title": "string",
    "description": "string",
    "steps": [
      { "name": "string", "notes": "string", "timestamp": "string|null" }
    ],
    "notes": "string|null",
    "tags": ["string"]
  },
  "review": { "available": true, "summary": "string|null" },
  "banner": { "available": true, "url": "string|null" },
  "meta": {
    "transcript_source": "string",
    "confidence": "number|null",
    "duration_ms": "number"
  }
}
```

## Error response
```json
{
  "ok": false,
  "error_code": "STRING_BUCKET",
  "message": "User-safe message",
  "run_id": "string|null"
}
```

### Error buckets and status codes
- `SERVICE_DISABLED` -> `503`
- `INVALID_URL` -> `400`
- `NO_CAPTIONS` -> `422`
- `TRANSCRIPT_EMPTY` -> `422`
- `PROVIDER_FAIL` -> `502`
- `TIMEOUT` -> `504`
- `RATE_LIMITED` -> `429`
- `SAFETY_BLOCKED` -> `422`
- `PII_BLOCKED` -> `422`
- `GENERATION_FAIL` -> `500`

## Runtime controls
- `YT2BP_ENABLED`
- `YT2BP_QUALITY_ENABLED`
- `YT2BP_CONTENT_SAFETY_ENABLED`
- `YT2BP_ANON_LIMIT_PER_MIN`
- `YT2BP_AUTH_LIMIT_PER_MIN`
- `YT2BP_IP_LIMIT_PER_HOUR`
- `CHANNEL_GATES_MODE` (`bypass|shadow|enforce`) for channel-candidate evaluation path outside this endpoint.

## Integration contract (bleuV1)
- This endpoint is responsible for source extraction + draft generation only.
- Persisting personal feed state and channel candidate promotion happens in separate app/backend flows.
- Channel publish/reject is intentionally out of this endpoint scope.
- Subscription sync and manual pending-card acceptance are intentionally outside this endpoint contract.
- Ingestion health polling (`/api/ingestion/jobs/latest`) is intentionally outside this endpoint contract.
- YouTube query discovery (`/api/youtube-search`) is intentionally outside this endpoint contract.
- YouTube channel discovery (`/api/youtube-channel-search`) is intentionally outside this endpoint contract.
- Subscription row avatar enrichment (`GET /api/source-subscriptions`) is intentionally outside this endpoint contract.
- Auto-banner queue processing and cap rebalance are intentionally outside this endpoint contract.

## Retry and timeout policy (v0)
- Endpoint timeout target: 120s.
- Quality retries: controlled by `YT2BP_QUALITY_MAX_RETRIES`.
- Content safety retries: controlled by `YT2BP_CONTENT_SAFETY_MAX_RETRIES`.
- Transcript fetch uses provider-level retry behavior.

## Current non-goals
- Playlist support.
- Multi-video merge.
- Instruction-security runtime checks (`llm_instruction_security_v0` is planned only).
- Contract-breaking schema changes.
- Direct channel publication from YT2BP call path.
