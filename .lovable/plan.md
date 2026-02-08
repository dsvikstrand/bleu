

# Migration Step 1: Centralized Config + API Client Wrapper

## Overview

This is a low-risk, zero-behavior-change refactor that creates two foundational files and updates existing `import.meta.env` references to flow through them. No UI changes, no DB migrations, no endpoint swaps.

## Branch

Since Lovable cannot create Git branches, you'll create this branch yourself in your local repo:

```
git checkout main
git checkout -b migration-backend-switch
```

Then either make the changes locally or cherry-pick Lovable's commits into this branch.

---

## File 1: `src/config/runtime.ts` -- Single source of truth

This module centralizes all environment variables into one typed export:

```typescript
export type BackendTarget = "lovable" | "self";

export const config = {
  backendTarget: (import.meta.env.VITE_BACKEND_TARGET ?? "lovable") as BackendTarget,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  agenticBackendUrl: import.meta.env.VITE_AGENTIC_BACKEND_URL as string | undefined,
  useAgenticBackend: import.meta.env.VITE_USE_AGENTIC_BACKEND === "true",
  basePath: import.meta.env.BASE_URL as string,
} as const;

/** Resolve the URL for a backend function by name. */
export function getFunctionUrl(fnName: string): string {
  if (config.useAgenticBackend && config.agenticBackendUrl) {
    return `${config.agenticBackendUrl.replace(/\/$/, "")}/api/${fnName}`;
  }
  return `${config.supabaseUrl}/functions/v1/${fnName}`;
}
```

Default behavior is identical: `VITE_BACKEND_TARGET` defaults to `"lovable"`, all existing env vars keep working.

---

## File 2: `src/lib/api.ts` -- Thin fetch wrapper

A lightweight API client that handles JSON, errors, and optional auth:

```typescript
import { supabase } from "@/integrations/supabase/client";
import { config, getFunctionUrl } from "@/config/runtime";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  stream?: boolean;  // return raw Response for SSE
};

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return `Bearer ${token}`;
  return `Bearer ${config.supabaseAnonKey}`;
}

export async function apiFetch(fnName: string, opts: ApiOptions = {}) {
  const url = getFunctionUrl(fnName);
  const authHeader = await getAuthHeader();

  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${fnName} ${res.status}: ${text}`);
  }

  if (opts.stream) return res;          // caller reads SSE
  return res.json();                    // default: parse JSON
}
```

This wrapper is **ready to use** but won't be wired into any actual calls yet (except optionally `log-event` as a safe first candidate).

---

## Refactoring: Files that get updated

These files currently use raw `import.meta.env.*` and will be updated to import from `src/config/runtime.ts` instead:

| File | What changes |
|------|-------------|
| `src/pages/InventoryCreate.tsx` | Replace env var reads with `config.*` and `getFunctionUrl("generate-inventory")` |
| `src/pages/InventoryBuild.tsx` | Replace env var reads with `config.*` and `getFunctionUrl("analyze-blueprint")` |
| `src/components/blueprint/BlueprintBuilder.tsx` | Same pattern as InventoryBuild |
| `src/hooks/useAiCredits.ts` | Replace `AGENTIC_BASE_URL` with `config.agenticBackendUrl` |
| `src/lib/logEvent.ts` | Replace `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with `config.*` |
| `src/contexts/AuthContext.tsx` | Replace `import.meta.env.BASE_URL` with `config.basePath` |
| `src/pages/Auth.tsx` | Replace `import.meta.env.BASE_URL` with `config.basePath` |
| `src/App.tsx` | Replace `import.meta.env.BASE_URL` with `config.basePath` |

**Not touched** (and should not be):
- `src/integrations/supabase/client.ts` -- auto-generated, stays as-is
- `src/integrations/lovable/index.ts` -- auto-generated, stays as-is

---

## Tricky spots / notes

1. **Duplicated URL-building logic**: The "agentic vs Supabase" URL pattern is copy-pasted across 3 files (`InventoryCreate`, `InventoryBuild`, `BlueprintBuilder`). `getFunctionUrl()` eliminates all 3 copies.

2. **Auth header branching**: The same "use access_token if agentic, else use anon key" logic is also duplicated in 3 places. `apiFetch()` or `getAuthHeader()` centralizes this. Even before files switch to `apiFetch()`, the auth logic can be imported as a standalone helper.

3. **`BASE_URL` is Vite-specific**: This is a build-time constant for the SPA base path, not really a "backend" config. Including it in `runtime.ts` keeps things centralized, but it's fine to leave `import.meta.env.BASE_URL` in place if you prefer -- it's not a migration concern.

4. **`log-event` is the safest first migration candidate**: It's fire-and-forget, no SSE streaming, simple POST. Ideal first function to route through `apiFetch()` to validate the wrapper works.

5. **No new env vars required**: `VITE_BACKEND_TARGET` is optional and defaults to `"lovable"`. Zero config change needed for current behavior.

---

## Summary of deliverables

- **2 new files**: `src/config/runtime.ts`, `src/lib/api.ts`
- **8 updated files**: Refactored to import from `config/runtime.ts` instead of raw `import.meta.env`
- **0 behavior changes**: Everything works exactly as before
- **Next step**: Wire `logMvpEvent` through `apiFetch("log-event", ...)` as a smoke test, then migrate one edge function at a time to your Oracle VM

