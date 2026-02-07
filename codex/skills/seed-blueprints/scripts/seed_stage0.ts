#!/usr/bin/env node
/**
 * Stage 0 LAS runner: read seed spec -> call agentic backend -> write JSON artifacts only.
 *
 * No Supabase writes should be performed in Stage 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type SeedSpec = {
  run_id: string;
  library: {
    topic: string;
    title: string;
    description: string;
    notes?: string;
    tags?: string[];
  };
  blueprints: Array<{
    title: string;
    description?: string;
    notes?: string;
    tags?: string[];
  }>;
};

type InventorySchema = {
  summary?: string;
  categories: Array<{
    name: string;
    items: string[];
  }>;
};

type GeneratedBlueprint = {
  title: string;
  steps: Array<{
    title: string;
    description: string;
    items: Array<{
      category: string;
      name: string;
      context?: string;
    }>;
  }>;
};

type ReviewPayload = {
  title: string;
  inventoryTitle: string;
  selectedItems: Record<string, Array<string | { name: string; context?: string }>>;
  mixNotes?: string;
  reviewPrompt?: string;
  reviewSections?: string[];
  includeScore?: boolean;
};

type BannerPayload = {
  title: string;
  inventoryTitle: string;
  tags: string[];
  dryRun?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + pad, 'base64').toString('utf8');
}

function getJwtSub(accessToken: string): string {
  const parts = accessToken.split('.');
  if (parts.length < 2) return '';
  try {
    const payloadJson = decodeBase64Url(parts[1] || '');
    const payload = JSON.parse(payloadJson) as { sub?: string };
    return typeof payload.sub === 'string' ? payload.sub : '';
  } catch {
    return '';
  }
}

function normalizeSlug(tag: string) {
  return String(tag || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqStrings(list: string[]) {
  return Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean)));
}

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    blueprintCount: number;
    stepCountTotal: number;
    itemRefsTotal: number;
  };
};

type RunLog = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  config: {
    specPath: string;
    outDir: string;
    agenticBaseUrl: string;
    backendCalls: boolean;
    applyStage1?: boolean;
    limitBlueprints?: number;
  };
  steps: Array<{
    name: string;
    startedAt: string;
    finishedAt?: string;
    ok: boolean;
    detail?: string;
    error?: { message: string; stack?: string };
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function die(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean | number> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--spec') out.spec = argv[++i] ?? '';
    else if (a === '--out') out.out = argv[++i] ?? '';
    else if (a === '--agentic-base-url') out.agenticBaseUrl = argv[++i] ?? '';
    else if (a === '--run-id') out.runId = argv[++i] ?? '';
    else if (a === '--no-backend') out.noBackend = true;
    else if (a === '--do-review') out.doReview = true;
    else if (a === '--review-focus') out.reviewFocus = argv[++i] ?? '';
    else if (a === '--do-banner') out.doBanner = true;
    else if (a === '--apply') out.apply = true;
    else if (a === '--yes') out.yes = argv[++i] ?? '';
    else if (a === '--limit-blueprints') out.limitBlueprints = Number(argv[++i] ?? 0);
    else if (a.startsWith('--')) die(`Unknown flag: ${a}`);
  }
  return out;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function writeTextFile(filePath: string, text: string) {
  fs.writeFileSync(filePath, text.endsWith('\n') ? text : text + '\n', 'utf-8');
}

function sanitizeRunId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function postJson<T>(
  url: string,
  token: string,
  body: unknown
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, text };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}

async function postSseText(
  url: string,
  token: string,
  body: unknown
): Promise<{ ok: true; text: string } | { ok: false; status: number; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, text };
  }

  const raw = await res.text().catch(() => '');
  let out = '';
  type SseFrame = {
    choices?: Array<{
      delta?: { content?: string };
    }>;
  };
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.replace(/^data:\s*/, '');
    if (!payload) continue;
    if (payload === '[DONE]') break;
    try {
      const frame = JSON.parse(payload) as SseFrame;
      const delta = frame.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') out += delta;
    } catch {
      // ignore malformed frames
    }
  }
  return { ok: true, text: out };
}

function validateSeedSpec(spec: SeedSpec): string[] {
  const errors: string[] = [];
  if (!spec || typeof spec !== 'object') return ['Spec must be a JSON object'];
  if (!spec.run_id || !spec.run_id.trim()) errors.push('run_id is required');
  if (!spec.library?.topic?.trim()) errors.push('library.topic is required');
  if (!spec.library?.title?.trim()) errors.push('library.title is required');
  if (!spec.blueprints || !Array.isArray(spec.blueprints) || spec.blueprints.length === 0) {
    errors.push('blueprints[] must be a non-empty array');
  } else {
    spec.blueprints.forEach((bp, i) => {
      if (!bp?.title?.trim()) errors.push(`blueprints[${i}].title is required`);
    });
  }
  return errors;
}

function buildLibraryIndex(inventory: InventorySchema) {
  const map = new Map<string, Set<string>>();
  for (const c of inventory.categories || []) {
    const name = (c.name || '').trim();
    if (!name) continue;
    const set = new Set((c.items || []).map((x) => (x || '').trim()).filter(Boolean));
    map.set(name, set);
  }
  return map;
}

function validateBlueprints(inventory: InventorySchema, blueprints: GeneratedBlueprint[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const index = buildLibraryIndex(inventory);
  let stepCountTotal = 0;
  let itemRefsTotal = 0;

  if (!inventory.categories || inventory.categories.length === 0) {
    errors.push('Inventory has no categories');
  }

  blueprints.forEach((bp, bpi) => {
    if (!bp.title?.trim()) errors.push(`blueprints[${bpi}] missing title`);
    if (!bp.steps || bp.steps.length === 0) errors.push(`blueprints[${bpi}] has no steps`);
    if ((bp.steps || []).length > 0 && bp.steps.length < 3) {
      warnings.push(`blueprints[${bpi}] has only ${bp.steps.length} steps (min recommended is 5)`);
    }

    (bp.steps || []).forEach((s, si) => {
      stepCountTotal += 1;
      if (!s.title?.trim()) warnings.push(`blueprints[${bpi}].steps[${si}] missing title`);
      if (!s.description?.trim()) warnings.push(`blueprints[${bpi}].steps[${si}] missing description`);
      if (!s.items || s.items.length === 0) errors.push(`blueprints[${bpi}].steps[${si}] has no items`);

      (s.items || []).forEach((it, ii) => {
        itemRefsTotal += 1;
        const cat = (it.category || '').trim();
        const name = (it.name || '').trim();
        if (!cat || !name) {
          errors.push(`blueprints[${bpi}].steps[${si}].items[${ii}] missing category or name`);
          return;
        }
        const allowed = index.get(cat);
        if (!allowed) {
          errors.push(`blueprints[${bpi}].steps[${si}].items[${ii}] category not in library: "${cat}"`);
          return;
        }
        if (!allowed.has(name)) {
          errors.push(
            `blueprints[${bpi}].steps[${si}].items[${ii}] item not in library: "${cat}" -> "${name}"`
          );
        }
      });
    });
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      blueprintCount: blueprints.length,
      stepCountTotal,
      itemRefsTotal,
    },
  };
}

function buildReviewPayload(spec: SeedSpec, bp: GeneratedBlueprint): ReviewPayload {
  const selectedItems: Record<string, Array<string | { name: string; context?: string }>> = {};
  for (const step of bp.steps || []) {
    for (const it of step.items || []) {
      const cat = (it.category || '').trim();
      const name = (it.name || '').trim();
      if (!cat || !name) continue;
      const list = selectedItems[cat] || [];
      list.push(it.context ? { name, context: it.context } : name);
      selectedItems[cat] = list;
    }
  }

  return {
    title: bp.title,
    inventoryTitle: spec.library.title,
    selectedItems,
    mixNotes: spec.library.notes || '',
    reviewPrompt: '',
    reviewSections: [],
    includeScore: true,
  };
}

function buildBannerPayload(spec: SeedSpec, bp: GeneratedBlueprint, idx: number): BannerPayload {
  const variantTags = spec.blueprints[idx]?.tags || [];
  const combined = [...(spec.library.tags || []), ...variantTags]
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(combined));
  return {
    title: bp.title,
    inventoryTitle: spec.library.title,
    tags: uniq,
    dryRun: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      [
        'seed_stage0.ts',
        '',
        'Usage:',
        '  tsx codex/skills/seed-blueprints/scripts/seed_stage0.ts --spec seed/seed_spec_v0.json',
        '',
        'Flags:',
        '  --spec <path>              Seed spec JSON path (default: seed/seed_spec_v0.json)',
        '  --out <dir>                Output base dir (default: seed/outputs)',
        '  --agentic-base-url <url>   Agentic backend base URL (default: env VITE_AGENTIC_BACKEND_URL or https://bapi.vdsai.cloud)',
        '  --run-id <id>              Override run_id folder name',
        '  --no-backend               Do not call backend (future use)',
        '  --do-review                Execute /api/analyze-blueprint (Stage 0.5)',
        '  --review-focus <text>      Optional reviewPrompt for /api/analyze-blueprint',
        '  --do-banner                Execute /api/generate-banner in dryRun mode (Stage 0.5; no Storage upload)',
        '  --apply                    Stage 1 apply mode (writes to Supabase)',
        '  --yes <token>              Stage 1 guard token (must be APPLY_STAGE1)',
        '  --limit-blueprints <n>     Limit generated/apply blueprints to N (useful for testing Stage 1)',
      ].join('\n') + '\n'
    );
    return;
  }

  const specPath = String(args.spec || 'seed/seed_spec_v0.json');
  const outBase = String(args.out || 'seed/outputs');
  const agenticBaseUrl =
    String(args.agenticBaseUrl || process.env.VITE_AGENTIC_BACKEND_URL || 'https://bapi.vdsai.cloud').replace(/\/$/, '');
  const backendCalls = !args.noBackend;
  const doReview = !!args.doReview;
  const doBanner = !!args.doBanner;
  const reviewFocus = String(args.reviewFocus || '').trim();

  if (!fs.existsSync(specPath)) die(`Spec not found: ${specPath}`);

  const spec = readJsonFile<SeedSpec>(specPath);
  const specErrors = validateSeedSpec(spec);
  if (specErrors.length) die(`Invalid spec:\n- ${specErrors.join('\n- ')}`);

  const runId = sanitizeRunId(String(args.runId || spec.run_id || 'run')) || crypto.randomUUID();
  const runDir = path.join(outBase, runId);
  ensureDir(runDir);

  const yes = String(args.yes || '').trim();
  const applyStage1 = Boolean(args.apply);
  const limitBlueprints = Number(args.limitBlueprints || 0) || 0;

  const runLog: RunLog = {
    runId,
    startedAt: nowIso(),
    config: {
      specPath,
      outDir: runDir,
      agenticBaseUrl,
      backendCalls,
      applyStage1,
      limitBlueprints,
    },
    steps: [],
  };

  const step = async <T>(name: string, fn: () => Promise<T>) => {
    const entry = { name, startedAt: nowIso(), ok: false as boolean } as RunLog['steps'][number];
    runLog.steps.push(entry);
    try {
      const result = await fn();
      entry.ok = true;
      entry.finishedAt = nowIso();
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      entry.ok = false;
      entry.finishedAt = nowIso();
      entry.error = { message: err.message, stack: err.stack };
      throw err;
    } finally {
      writeJsonFile(path.join(runDir, 'run_log.json'), { ...runLog, finishedAt: nowIso() });
    }
  };

  // Stage 0 "behave as a user": call backend endpoints using a real user access token.
  const accessToken = process.env.SEED_USER_ACCESS_TOKEN?.trim() || '';
  if (backendCalls && !accessToken) {
    die('Missing SEED_USER_ACCESS_TOKEN. Set it in your shell before running Stage 0.');
  }

  const seedUserId = accessToken ? getJwtSub(accessToken) : '';
  if (applyStage1 && !seedUserId) {
    die('Could not derive seed user id from SEED_USER_ACCESS_TOKEN (JWT sub missing).');
  }

  const inventory = await step('generate_library', async () => {
    if (!backendCalls) throw new Error('Backend calls disabled (no-backend not implemented in Stage 0)');
    const url = `${agenticBaseUrl}/api/generate-inventory`;
    const body = {
      keywords: spec.library.topic,
      title: spec.library.title,
      customInstructions: spec.library.notes || '',
    };
    const res = await postJson<InventorySchema>(url, accessToken, body);
    if (!res.ok) {
      throw new Error(`generate-inventory failed (${res.status}): ${res.text.slice(0, 500)}`);
    }
    writeJsonFile(path.join(runDir, 'library.json'), {
      ...spec.library,
      generated: res.data,
    });
    return res.data;
  });

  const generatedBlueprints = await step('generate_blueprints', async () => {
    if (!backendCalls) throw new Error('Backend calls disabled (no-backend not implemented in Stage 0)');
    const url = `${agenticBaseUrl}/api/generate-blueprint`;
    const categories = (inventory.categories || []).map((c) => ({ name: c.name, items: c.items }));

    const results: Array<{
      spec: SeedSpec['blueprints'][number];
      generated: GeneratedBlueprint;
    }> = [];

    const blueprintSpecs = limitBlueprints > 0 ? spec.blueprints.slice(0, limitBlueprints) : spec.blueprints;
    for (const bp of blueprintSpecs) {
      const body = {
        title: bp.title,
        description: bp.description || '',
        notes: bp.notes || '',
        inventoryTitle: spec.library.title,
        categories,
      };
      const res = await postJson<GeneratedBlueprint>(url, accessToken, body);
      if (!res.ok) {
        throw new Error(`generate-blueprint failed (${res.status}): ${res.text.slice(0, 500)}`);
      }
      results.push({ spec: bp, generated: res.data });
    }

    writeJsonFile(path.join(runDir, 'blueprints.json'), {
      libraryTitle: spec.library.title,
      blueprints: results,
    });
    const list = results.map((r) => r.generated);
    return list;
  });

  const reviewPayloads = await step('generate_review_requests', async () => {
    // Stage 0: do not call review endpoint (cost + credits). Produce payloads only.
    const payloads = generatedBlueprints.map((bp) => buildReviewPayload(spec, bp));
    writeJsonFile(path.join(runDir, 'review_requests.json'), payloads);
    return payloads;
  });

  const bannerPayloads = await step('generate_banner_requests', async () => {
    // Stage 0: do not call banner endpoint (would upload to Storage). Produce payloads only.
    const payloads = generatedBlueprints.map((bp, idx) => buildBannerPayload(spec, bp, idx));
    writeJsonFile(path.join(runDir, 'banner_requests.json'), payloads);
    return payloads;
  });

  if (doReview) {
    await step('execute_review', async () => {
      if (!backendCalls) throw new Error('Backend calls disabled');
      const url = `${agenticBaseUrl}/api/analyze-blueprint`;
      const results: Array<{ title: string; review: string }> = [];

      for (const payload of reviewPayloads) {
        const body = {
          ...payload,
          reviewPrompt: reviewFocus || payload.reviewPrompt || '',
        };
        const res = await postSseText(url, accessToken, body);
        if (!res.ok) {
          throw new Error(`analyze-blueprint failed (${res.status}): ${res.text.slice(0, 500)}`);
        }
        results.push({ title: payload.title, review: res.text });
      }

      writeJsonFile(path.join(runDir, 'reviews.json'), results);
      return { count: results.length };
    });
  }

  if (doBanner) {
    await step('execute_banner', async () => {
      if (!backendCalls) throw new Error('Backend calls disabled');
      const url = `${agenticBaseUrl}/api/generate-banner`;
      const maxAttempts = 3;
      const results: Array<
        | { title: string; ok: true; attempts: number; contentType: string; imageBase64: string }
        | { title: string; ok: false; attempts: number; status?: number; error: string }
      > = [];

      for (const payload of bannerPayloads) {
        let attempts = 0;
        let lastErr: { status?: number; text: string } | null = null;

        while (attempts < maxAttempts) {
          attempts += 1;
          const res = await postJson<{ contentType: string; imageBase64: string }>(url, accessToken, payload);
          if (res.ok) {
            results.push({
              title: payload.title,
              ok: true,
              attempts,
              contentType: res.data.contentType,
              imageBase64: res.data.imageBase64,
            });
            lastErr = null;
            break;
          }

          lastErr = { status: res.status, text: res.text };

          const shouldRetry = res.status === 429 || res.status >= 500;
          if (!shouldRetry || attempts >= maxAttempts) break;
          await sleep(800 * attempts);
        }

        if (lastErr) {
          results.push({
            title: payload.title,
            ok: false,
            attempts,
            status: lastErr.status,
            error: lastErr.text.slice(0, 1000),
          });
        }
      }

      writeJsonFile(path.join(runDir, 'banners.json'), results);
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;
      return { okCount, failCount, count: results.length };
    });
  }

  const validation = await step('validate', async () => {
    const result = validateBlueprints(inventory, generatedBlueprints);
    writeJsonFile(path.join(runDir, 'validation.json'), result);
    return result;
  });

  if (applyStage1) {
    if (!validation.ok) {
      throw new Error('Refusing Stage 1 apply: validation.ok is false. Fix generation/selection first.');
    }

    await step('apply_stage1_guard', async () => {
      if (yes !== 'APPLY_STAGE1') {
        throw new Error('Stage 1 apply is gated. Re-run with: --apply --yes APPLY_STAGE1');
      }
      return { ok: true };
    });

    const supabaseUrl =
      String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY for Stage 1.');
    }

    const restBase = `${supabaseUrl}/rest/v1`;
    const restHeaders = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    } as const;

    const restInsert = async <T>(table: string, row: unknown, select: string) => {
      const url = `${restBase}/${table}?select=${encodeURIComponent(select)}`;
      const res = await fetch(url, { method: 'POST', headers: restHeaders as any, body: JSON.stringify(row) });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Supabase insert ${table} failed (${res.status}): ${text.slice(0, 800)}`);
      const data = JSON.parse(text) as T[];
      if (!Array.isArray(data) || data.length === 0) throw new Error(`Supabase insert ${table} returned no rows`);
      return data[0]!;
    };

    const restUpdate = async <T>(table: string, filter: string, patch: unknown, select: string) => {
      const url = `${restBase}/${table}?${filter}&select=${encodeURIComponent(select)}`;
      const res = await fetch(url, { method: 'PATCH', headers: restHeaders as any, body: JSON.stringify(patch) });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Supabase update ${table} failed (${res.status}): ${text.slice(0, 800)}`);
      const data = JSON.parse(text) as T[];
      return Array.isArray(data) ? data : [];
    };

    const restGet = async <T>(table: string, query: string) => {
      const url = `${restBase}/${table}?${query}`;
      const res = await fetch(url, { method: 'GET', headers: restHeaders as any });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Supabase get ${table} failed (${res.status}): ${text.slice(0, 800)}`);
      return JSON.parse(text) as T[];
    };

    const ensureTags = async (slugs: string[]) => {
      const normalized = uniqStrings(slugs.map(normalizeSlug)).filter(Boolean);
      if (normalized.length === 0) return [] as Array<{ id: string; slug: string }>;

      const existing = await restGet<{ id: string; slug: string }>(
        'tags',
        `select=id,slug&slug=in.(${normalized.map(encodeURIComponent).join(',')})`
      );
      const existingSlugs = new Set((existing || []).map((t) => t.slug));
      const missing = normalized.filter((s) => !existingSlugs.has(s));

      let created: Array<{ id: string; slug: string }> = [];
      for (const slug of missing) {
        const row = await restInsert<{ id: string; slug: string }>('tags', { slug, created_by: seedUserId }, 'id,slug');
        created.push(row);
      }
      return [...(existing || []), ...created];
    };

    const applyLog: Record<string, unknown> = {
      runId,
      supabaseUrl,
      startedAt: nowIso(),
      inventoryId: null,
      blueprintIds: [] as string[],
      bannerUploads: [] as Array<{ blueprintTitle: string; ok: boolean; bannerUrl?: string; error?: string }>,
    };

    const invTags = ensureTags(spec.library.tags || []);
    const inventoryRow = await step('apply_T1_insert_inventory', async () => {
      const categories = (inventory.categories || []).map((c) => c.name).filter(Boolean);
      const promptCategories = categories.join(', ');
      const row = await restInsert<{ id: string }>(
        'inventories',
        {
          title: spec.library.title,
          prompt_inventory: spec.library.topic,
          prompt_categories: promptCategories,
          generated_schema: inventory,
          review_sections: ['Overview', 'Strengths', 'Gaps', 'Suggestions'],
          include_score: true,
          creator_user_id: seedUserId,
          is_public: false,
        },
        'id'
      );
      applyLog.inventoryId = row.id;
      return row;
    });

    await step('apply_T1_tag_inventory', async () => {
      const tags = await invTags;
      if (tags.length === 0) return { count: 0 };
      const rows = tags.map((t) => ({ inventory_id: (inventoryRow as any).id, tag_id: t.id }));
      // Insert join rows one-by-one to keep failure mode obvious.
      for (const r of rows) {
        await restInsert('inventory_tags', r, 'inventory_id,tag_id');
      }
      return { count: rows.length };
    });

    const blueprintIds: string[] = [];
    const blueprintIdByTitle = new Map<string, string>();

    await step('apply_T2_insert_blueprints', async () => {
      let idx = 0;
      for (const bp of generatedBlueprints) {
        const variant = spec.blueprints[idx] || {};
        idx += 1;

        const selectedItems: Record<string, Array<string | { name: string; context?: string }>> = {};
        for (const st of bp.steps || []) {
          for (const it of st.items || []) {
            const cat = String(it.category || '').trim();
            const name = String(it.name || '').trim();
            if (!cat || !name) continue;
            const list = selectedItems[cat] || [];
            list.push(it.context ? { name, context: it.context } : name);
            selectedItems[cat] = list;
          }
        }

        const mixNotes = String(variant.notes || spec.library.notes || '').trim() || null;
        const row = await restInsert<{ id: string }>(
          'blueprints',
          {
            inventory_id: (inventoryRow as any).id,
            creator_user_id: seedUserId,
            title: bp.title,
            selected_items: selectedItems,
            steps: bp.steps,
            mix_notes: mixNotes,
            review_prompt: reviewFocus || null,
            llm_review: null,
            banner_url: null,
            is_public: false,
            source_blueprint_id: null,
          },
          'id'
        );
        blueprintIds.push(row.id);
        blueprintIdByTitle.set(bp.title, row.id);
      }
      applyLog.blueprintIds = blueprintIds;
      return { count: blueprintIds.length };
    });

    await step('apply_T2_tag_blueprints', async () => {
      let idx = 0;
      for (const bp of generatedBlueprints) {
        const variant = spec.blueprints[idx] || {};
        idx += 1;
        const title = bp.title;
        const bpId = blueprintIdByTitle.get(title);
        if (!bpId) continue;
        const tags = await ensureTags([...(spec.library.tags || []), ...((variant as any).tags || [])]);
        for (const t of tags) {
          await restInsert('blueprint_tags', { blueprint_id: bpId, tag_id: t.id }, 'blueprint_id,tag_id');
        }
      }
      return { ok: true };
    });

    await step('apply_T4_persist_reviews', async () => {
      const reviewsPath = path.join(runDir, 'reviews.json');
      if (!fs.existsSync(reviewsPath)) return { skipped: true };
      const reviews = readJsonFile<Array<{ title: string; review: string }>>(reviewsPath);
      for (const r of reviews) {
        const bpId = blueprintIdByTitle.get(r.title);
        if (!bpId) continue;
        await restUpdate('blueprints', `id=eq.${bpId}`, { llm_review: r.review }, 'id');
      }
      return { count: reviews.length };
    });

    await step('apply_T3_upload_banners', async () => {
      const bannersPath = path.join(runDir, 'banners.json');
      if (!fs.existsSync(bannersPath)) return { skipped: true };
      const banners = readJsonFile<
        Array<{ title: string; ok: true; contentType: string; imageBase64: string } | { title: string; ok: false; error: string }>
      >(bannersPath);

      const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/upload-banner`;
      for (const b of banners) {
        const bpId = blueprintIdByTitle.get(b.title);
        if (!bpId) continue;

        if (!('ok' in b) || !b.ok) {
          (applyLog.bannerUploads as any).push({ blueprintTitle: b.title, ok: false, error: (b as any).error || 'no banner' });
          continue;
        }

        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contentType: b.contentType,
            imageBase64: b.imageBase64,
          }),
        });

        const text = await res.text().catch(() => '');
        if (!res.ok) {
          (applyLog.bannerUploads as any).push({ blueprintTitle: b.title, ok: false, error: text.slice(0, 800) });
          continue;
        }
        const data = JSON.parse(text) as { bannerUrl?: string };
        const bannerUrl = String(data.bannerUrl || '');
        if (!bannerUrl) {
          (applyLog.bannerUploads as any).push({ blueprintTitle: b.title, ok: false, error: 'missing bannerUrl' });
          continue;
        }
        await restUpdate('blueprints', `id=eq.${bpId}`, { banner_url: bannerUrl }, 'id');
        (applyLog.bannerUploads as any).push({ blueprintTitle: b.title, ok: true, bannerUrl });
      }

      return { count: (applyLog.bannerUploads as any).length };
    });

    await step('apply_T5_publish', async () => {
      // Publish blueprints first, then the inventory.
      for (const id of blueprintIds) {
        await restUpdate('blueprints', `id=eq.${id}`, { is_public: true }, 'id');
      }
      await restUpdate('inventories', `id=eq.${(inventoryRow as any).id}`, { is_public: true }, 'id');
      return { blueprintCount: blueprintIds.length };
    });

    applyLog.finishedAt = nowIso();
    writeJsonFile(path.join(runDir, 'apply_log.json'), applyLog);

    // Best-effort rollback artifacts (user runs manually in SQL console if needed).
    const rollbackSql = [
      '-- Rollback for seed run',
      `-- run_id: ${runId}`,
      '',
      'BEGIN;',
      `DELETE FROM public.blueprint_tags WHERE blueprint_id IN (${blueprintIds.map((id) => `'${id}'`).join(',')});`,
      `DELETE FROM public.blueprints WHERE id IN (${blueprintIds.map((id) => `'${id}'`).join(',')});`,
      `DELETE FROM public.inventory_tags WHERE inventory_id = '${(inventoryRow as any).id}';`,
      `DELETE FROM public.inventories WHERE id = '${(inventoryRow as any).id}';`,
      'COMMIT;',
      '',
    ].join('\n');
    writeTextFile(path.join(runDir, 'rollback.sql'), rollbackSql);
  }

  await step('publish_payload', async () => {
    const payload = {
      run_id: runId,
      library: spec.library,
      inventory: inventory,
      blueprints: generatedBlueprints,
      notes: 'Stage 0 only: no DB writes. Stage 1 will translate this payload into Supabase inserts.',
    };
    writeJsonFile(path.join(runDir, 'publish_payload.json'), payload);
    return { ok: validation.ok };
  });

  runLog.finishedAt = nowIso();
  writeJsonFile(path.join(runDir, 'run_log.json'), runLog);
  process.stdout.write(`Stage 0 complete. Output: ${runDir}\n`);
}

main().catch((e) => {
  const err = e instanceof Error ? e : new Error(String(e));
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
