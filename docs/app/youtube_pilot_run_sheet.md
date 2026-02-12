# YouTube Pilot Run Sheet (MVP)

## Pilot Config
- Scope: English-first output, include one Spanish edge case
- Max video length: 30 minutes
- Content mix: all video types
- Expected-fail policy: no-captions/transcript-unavailable are expected fails
- Retry policy: 1 automatic retry for transient transcript fetch failures

## Success Thresholds
- Generation success rate: >= 75%
- Publish rate (of successful generations): >= 60%
- Median generation time: <= 60s
- P95 generation time: <= 120s

## Run Phases
- Phase A (baseline): `generate_review=false`, `generate_banner=false` for all 10 URLs
- Phase B (review spot-check): run 3 random URLs with `generate_review=true`, `generate_banner=false`
- Phase C (banner spot-check): run 3 random URLs with `generate_review=false`, `generate_banner=true`

## Result Sheet
| id | url | language_tag | duration_min | edge_case | review | banner | expected_fail | result | error_code | duration_ms | published_blueprint_id | notes |
|---|---|---|---:|---|---|---|---|---|---|---:|---|---|
| yt01 | https://www.youtube.com/watch?v=16hFQZbxZpU | en |  |  | false | false | false | success |  | 10172 | n/a (api-only pilot) | phase A |
| yt02 | https://www.youtube.com/watch?v=ojAjUKcx7p4 | en |  |  | false | false | false | success |  | 7829 | n/a (api-only pilot) | phase A |
| yt03 | https://www.youtube.com/watch?v=nB-JDz31nA8 | en |  |  | false | false | false | success |  | 7585 | n/a (api-only pilot) | phase A |
| yt04 | https://www.youtube.com/watch?v=t3NOLXEWLt4 | en |  |  | false | false | false | success |  | 7415 | n/a (api-only pilot) | phase A |
| yt05 | https://www.youtube.com/watch?v=RD21wzI5Y6w | en |  |  | false | false | false | success |  | 8941 | n/a (api-only pilot) | phase A |
| yt06 | https://www.youtube.com/watch?v=GXxtIjGUecQ | en |  |  | false | false | false | success |  | 6546 | n/a (api-only pilot) | phase A |
| yt07 | https://www.youtube.com/watch?v=aTQwEpq6orE | en |  |  | false | false | false | success |  | 3658 | n/a (api-only pilot) | phase A |
| yt08 | https://www.youtube.com/watch?v=aL-W_9r8ujw | en |  |  | false | false | false | success |  | 9042 | n/a (api-only pilot) | phase A |
| yt09 | https://www.youtube.com/watch?v=tOCT7KqlIsM | en/es |  | spanish_edge | false | false | false | success |  | 9160 | n/a (api-only pilot) | phase A |
| yt10 | https://www.youtube.com/watch?v=CSgjaC6y6Mk | en |  | long_video_edge | false | false | false | success |  | 8715 | n/a (api-only pilot) | phase A |
| yt11 | https://www.youtube.com/watch?v=GXxtIjGUecQ | en |  | review_spot_check | true | false | false | success |  | 16497 | n/a (api-only pilot) | phase B (index 6) |
| yt12 | https://www.youtube.com/watch?v=t3NOLXEWLt4 | en |  | review_spot_check | true | false | false | success |  | 11893 | n/a (api-only pilot) | phase B (index 4) |
| yt13 | https://www.youtube.com/watch?v=aL-W_9r8ujw | en |  | review_spot_check | true | false | false | success |  | 12821 | n/a (api-only pilot) | phase B (index 8) |
| yt14 | https://www.youtube.com/watch?v=aTQwEpq6orE | en |  | banner_spot_check | false | true | false | success |  | 5451 | n/a (api-only pilot) | phase C (index 7) |
| yt15 | https://www.youtube.com/watch?v=ojAjUKcx7p4 | en |  | banner_spot_check | false | true | false | success |  | 19365 | n/a (api-only pilot) | phase C (index 2) |
| yt16 | https://www.youtube.com/watch?v=tOCT7KqlIsM | en/es |  | spanish_edge,banner_spot_check | false | true | false | success |  | 6735 | n/a (api-only pilot) | phase C (index 9) |

## Summary Metrics (fill after runs)
- submit_count: 10 (phase A baseline)
- success_count: 10
- expected_fail_count: 0
- unexpected_fail_count: 0
- generation_success_rate: 100%
- publish_rate: n/a (API-only pilot did not execute save/publish mutation)
- median_duration_ms: 7829
- p95_duration_ms: 9160
- top_error_codes: none

## Decision
- GO / HOLD / PIVOT: GO
- Notes: Reliability and speed thresholds passed on baseline and spot-check phases. Next action is a small UI-inclusive publish-path pilot to measure true publish_rate.
