# Agentic Endpoints (Stage 0)

## Agentic backend
- `POST /api/generate-blueprint`
  - Body:
    ```json
    {
      "title": "...",
      "description": "...",
      "notes": "...",
      "inventoryTitle": "...",
      "categories": [{"name": "...", "items": ["..."]}]
    }
    ```
  - Returns:
    ```json
    { "title": "...", "steps": [ { "title": "...", "description": "...", "items": [ {"category": "...", "name": "...", "context": "..."} ] } ] }
    ```

- `POST /api/generate-inventory`
  - Body:
    ```json
    { "keywords": "...", "title": "...", "customInstructions": "...", "preferredCategories": ["..."] }
    ```

## Agentic backend (Stage 0.5)
- `POST /api/analyze-blueprint`
  - Returns SSE-style frames; the runner stitches the streamed text into a single review string.
- `POST /api/generate-banner` with `dryRun: true`
  - Returns `{ "contentType": "image/png", "imageBase64": "..." }` (no Storage upload).

## Supabase (Stage 1 apply mode)

Stage 1 uses Supabase REST + one edge function:

- REST base: `GET/POST/PATCH {SUPABASE_URL}/rest/v1/...`
  - Required headers:
    - `apikey: {SUPABASE_ANON_KEY}`
    - `Authorization: Bearer {SEED_USER_ACCESS_TOKEN}`
    - `Content-Type: application/json`
    - `Prefer: return=representation`

- Edge function upload:
  - `POST {SUPABASE_URL}/functions/v1/upload-banner`
  - Headers:
    - `Authorization: Bearer {SEED_USER_ACCESS_TOKEN}`
    - `Content-Type: application/json`
  - Body:
    ```json
    { "contentType": "image/png", "imageBase64": "..." }
    ```
  - Returns:
    ```json
    { "bannerUrl": "https://..." }
    ```

## Notes
- Stage 0 uses these endpoints and stores JSON outputs only.
