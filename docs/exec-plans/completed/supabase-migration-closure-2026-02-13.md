# Supabase Migration Closure (2026-02-13)

Status
a1) [have] Primary runtime now uses the new Supabase project (auth, data, storage, edge-function paths verified in app flows).
a2) [have] Selective patch-track promotion to `main` completed safely.
a3) [have] Oracle backend pulled latest `main` and was restarted successfully.
a4) [have] YT2BP score output is now enabled and verified live after deploy.
a5) [have] Runtime credit usage file moved out of repo path on Oracle to avoid git noise.

## Finalized Commits (Main)
b1) [have] `e770956` — selective patch-track promotion baseline (Lovable/Supabase patch set).
b2) [have] `254a7ce` — removed deprecated `VITE_USE_AGENTIC_BACKEND` toggle path.
b3) [have] `800f460` — enabled scored YouTube review output (`includeScore: true`).
b4) [have] `ea1ea9d` — fixed Blueprints `latest` list filtering regression.

## Oracle Operational Lock-In
c1) [have] Backend service active: `agentic-backend.service`.
c2) [have] Env override set: `AI_USAGE_FILE=/var/lib/bleu/ai-usage.json`.
c3) [have] Legacy repo-local runtime data path removed (`server/data/` no longer pollutes `git status`).
c4) [have] `/api/health` returns `{"ok":true}` after restart.

## Smoke Verification Snapshot
d1) [have] Auth login and app session are working on new Supabase project.
d2) [have] Core create/generate flows are working (library/blueprint and YouTube pipeline).
d3) [have] YouTube generation produces banner + review; review includes score format (`X/100`) after deploy.
d4) [have] New canary YouTube blueprints were inserted and discoverable by unique title/tag lookups.

## Migration Verdict
e1) [have] Migration is operationally complete for MVP usage.
e2) [todo] Optional hardening later:
- move remaining runtime-state envs into explicit ops docs table.
- add a compact post-deploy smoke script for auth + create + yt2bp score check in one command.

