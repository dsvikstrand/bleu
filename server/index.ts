import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import { createLLMClient } from './llm/client';
import { consumeCredit, getCredits } from './credits';
import { getTranscriptForVideo } from './transcript/getTranscript';
import { TranscriptProviderError } from './transcript/types';
import { getAdapterForUrl } from './adapters/registry';
import { evaluateCandidateForChannel } from './gates';
import {
  fetchYouTubeFeed,
  isNewerThanCheckpoint,
  resolveYouTubeChannel,
  type YouTubeFeedVideo,
} from './services/youtubeSubscriptions';
import type {
  BlueprintAnalysisRequest,
  BlueprintGenerationRequest,
  BlueprintGenerationResult,
  BlueprintSelectedItem,
  InventoryRequest,
} from './llm/types';

const app = express();
const port = Number(process.env.PORT) || 8787;

// We run behind a single reverse proxy (nginx). Avoid permissive `true`.
app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : null;

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 60;
const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

app.use(limiter);

const yt2bpAnonLimitPerMin = Number(process.env.YT2BP_ANON_LIMIT_PER_MIN) || 6;
const yt2bpAuthLimitPerMin = Number(process.env.YT2BP_AUTH_LIMIT_PER_MIN) || 20;
const yt2bpIpLimitPerHour = Number(process.env.YT2BP_IP_LIMIT_PER_HOUR) || 30;
const yt2bpEnabledRaw = String(process.env.YT2BP_ENABLED ?? 'true').trim().toLowerCase();
const yt2bpEnabled = !(yt2bpEnabledRaw === 'false' || yt2bpEnabledRaw === '0' || yt2bpEnabledRaw === 'off');
const ingestionServiceToken = String(process.env.INGESTION_SERVICE_TOKEN || '').trim();
const manualBackfillLimit = Math.max(1, Number(process.env.SUBSCRIPTIONS_MANUAL_BACKFILL_LIMIT) || 5);
const ingestionMaxPerSubscription = Math.max(1, Number(process.env.INGESTION_MAX_PER_SUBSCRIPTION) || 5);

function getRetryAfterSeconds(req: express.Request) {
  const resetTime = (req as express.Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  if (!resetTime) return undefined;
  const seconds = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  return Number.isFinite(seconds) ? seconds : undefined;
}

function yt2bpRateLimitHandler(
  limiter: 'anon' | 'auth' | 'ip_hourly',
  req: express.Request,
  res: express.Response,
) {
  const retryAfter = getRetryAfterSeconds(req);
  res.locals.rateLimited = true;
  res.locals.rateLimiter = limiter;
  res.locals.bucketErrorCode = 'RATE_LIMITED';
  return res.status(429).json({
    ok: false,
    error_code: 'RATE_LIMITED',
    message: 'Too many requests right now. Please wait a bit and try again.',
    retry_after_seconds: retryAfter,
    run_id: null,
  });
}

const yt2bpAnonLimiter = rateLimit({
  windowMs: 60_000,
  max: yt2bpAnonLimitPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (_req, res) => !!(res.locals.user as { id?: string } | undefined)?.id,
  handler: (req, res) => yt2bpRateLimitHandler('anon', req, res),
});

const yt2bpAuthLimiter = rateLimit({
  windowMs: 60_000,
  max: yt2bpAuthLimitPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const user = res.locals.user as { id?: string } | undefined;
    return user?.id || req.ip;
  },
  skip: (_req, res) => !(res.locals.user as { id?: string } | undefined)?.id,
  handler: (req, res) => yt2bpRateLimitHandler('auth', req, res),
});

const yt2bpIpHourlyLimiter = rateLimit({
  windowMs: 3_600_000,
  max: yt2bpIpLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => yt2bpRateLimitHandler('ip_hourly', req, res),
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const extra = [
      res.locals.bucketErrorCode ? `bucket_error_code=${String(res.locals.bucketErrorCode)}` : '',
      res.locals.rateLimited ? `rate_limited=${String(res.locals.rateLimited)}` : '',
      res.locals.rateLimiter ? `limiter=${String(res.locals.rateLimiter)}` : '',
    ].filter(Boolean);
    const line = [
      req.ip,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${durationMs.toFixed(1)}ms`,
      ...extra,
    ].join(' ');
    console.log(line);
  });
  next();
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/api/health') return next();
  const allowsAnonymous = req.path === '/api/youtube-to-blueprint'
    || req.path === '/api/ingestion/jobs/trigger';

  if (!supabaseClient) {
    if (allowsAnonymous) return next();
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    if (allowsAnonymous) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }

  supabaseClient.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.locals.user = data.user;
      res.locals.authToken = token;
      return next();
    })
    .catch(() => res.status(401).json({ error: 'Unauthorized' }));
});

const InventoryRequestSchema = z.object({
  keywords: z.string().min(1),
  title: z.string().optional(),
  customInstructions: z.string().optional(),
  preferredCategories: z.array(z.string()).optional(),
});

const SelectedItemSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    context: z.string().optional(),
  }),
]);

const BlueprintReviewSchema = z.object({
  title: z.string().min(1),
  inventoryTitle: z.string().min(1),
  selectedItems: z.record(z.array(SelectedItemSchema)),
  mixNotes: z.string().optional(),
  reviewPrompt: z.string().optional(),
  reviewSections: z.array(z.string()).optional(),
  includeScore: z.boolean().optional(),
});

const BannerRequestSchema = z.object({
  title: z.string().min(1),
  inventoryTitle: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Seed pipelines may want to generate without writing to Storage.
  dryRun: z.boolean().optional(),
});

const BlueprintGenerationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  inventoryTitle: z.string().min(1),
  categories: z.array(
    z.object({
      name: z.string().min(1),
      items: z.array(z.string()).min(1),
    })
  ).min(1),
});

const YouTubeToBlueprintRequestSchema = z.object({
  video_url: z.string().min(1),
  generate_review: z.boolean().default(false),
  generate_banner: z.boolean().default(false),
  source: z.literal('youtube_mvp').default('youtube_mvp'),
});
const GENERIC_YT2BP_FAILURE_MESSAGE = 'Could not complete the blueprint. Please test another video.';

type YouTubeDraftStep = {
  name: string;
  notes: string;
  timestamp: string | null;
};

type YouTubeDraft = {
  title: string;
  description: string;
  steps: YouTubeDraftStep[];
  notes: string | null;
  tags: string[];
};

type QualityCriterion = {
  id: string;
  text: string;
  required: boolean;
  min_score: number;
};

type Yt2bpQualityConfig = {
  enabled: boolean;
  judge_model: string;
  prompt_version: string;
  scale: { min: number; max: number };
  retry_policy: { max_retries: number; selection: 'best_overall' };
  criteria: QualityCriterion[];
};

type SafetyCriterion = {
  id: string;
  text: string;
  required: boolean;
};

type Yt2bpContentSafetyConfig = {
  enabled: boolean;
  judge_model: string;
  prompt_version: string;
  retry_policy: { max_retries: number; selection: 'first_pass' };
  criteria: SafetyCriterion[];
};

const QualityJudgeResponseSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string().min(1),
      score: z.number().finite(),
    })
  ),
  overall: z.number().finite().optional(),
});

const ContentSafetyJudgeResponseSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      pass: z.boolean(),
      rationale: z.string().optional(),
    })
  ),
  blocked: z.boolean(),
});

function readYt2bpQualityConfig(): Yt2bpQualityConfig {
  const fallback: Yt2bpQualityConfig = {
    enabled: true,
    judge_model: 'o4-mini',
    prompt_version: 'yt2bp_quality_v0',
    scale: { min: 0, max: 5 },
    retry_policy: { max_retries: 1, selection: 'best_overall' },
    criteria: [
      { id: 'step_purpose_clarity', text: 'Each step has a clear purpose.', required: true, min_score: 3.5 },
      { id: 'step_actionability', text: 'Steps are actionable and specific.', required: true, min_score: 3.5 },
      { id: 'step_redundancy_control', text: 'Steps are not overly redundant or fragmented.', required: true, min_score: 3.5 },
      { id: 'sequence_progression', text: 'Steps follow a natural and coherent progression.', required: true, min_score: 3.5 },
      { id: 'coverage_sufficiency', text: 'The set covers core actions without critical gaps.', required: true, min_score: 3.5 },
    ],
  };

  const configPath = path.join(process.cwd(), 'eval', 'methods', 'v0', 'llm_blueprint_quality_v0', 'global_pack_v0.json');
  let loaded = fallback;
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      loaded = {
        ...fallback,
        ...parsed,
        scale: { ...fallback.scale, ...(parsed?.scale || {}) },
        retry_policy: { ...fallback.retry_policy, ...(parsed?.retry_policy || {}) },
        criteria: Array.isArray(parsed?.criteria) ? parsed.criteria : fallback.criteria,
      };
    } catch {
      loaded = fallback;
    }
  }

  const envEnabledRaw = String(process.env.YT2BP_QUALITY_ENABLED ?? '').trim().toLowerCase();
  const enabled =
    envEnabledRaw === ''
      ? Boolean(loaded.enabled)
      : !(envEnabledRaw === '0' || envEnabledRaw === 'false' || envEnabledRaw === 'off' || envEnabledRaw === 'no');

  const envModel = String(process.env.YT2BP_QUALITY_MODEL || '').trim();
  const envMaxRetriesRaw = Number(process.env.YT2BP_QUALITY_MAX_RETRIES);
  const envMinScoreRaw = Number(process.env.YT2BP_QUALITY_MIN_SCORE);
  const envMinScore = Number.isFinite(envMinScoreRaw) ? envMinScoreRaw : null;

  const min = Number(loaded.scale?.min ?? 0);
  const max = Number(loaded.scale?.max ?? 5);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const criteria = (loaded.criteria || [])
    .map((c) => ({
      id: String(c?.id || '').trim(),
      text: String(c?.text || '').trim(),
      required: Boolean(c?.required),
      min_score: clamp(Number.isFinite(Number(c?.min_score)) ? Number(c?.min_score) : 3.5),
    }))
    .filter((c) => c.id && c.text);

  const criteriaWithOverride = envMinScore === null
    ? criteria
    : criteria.map((c) => ({ ...c, min_score: clamp(envMinScore) }));

  const maxRetriesBase = Number(loaded.retry_policy?.max_retries ?? 2);
  const maxRetries = Number.isFinite(envMaxRetriesRaw) ? envMaxRetriesRaw : maxRetriesBase;

  return {
    enabled,
    judge_model: envModel || String(loaded.judge_model || fallback.judge_model),
    prompt_version: String(loaded.prompt_version || fallback.prompt_version),
    scale: { min, max },
    retry_policy: {
      // Keep YT2BP quality retries tight for public endpoint latency budget.
      // External requests often traverse a ~60s proxy boundary.
      max_retries: Math.max(0, Math.min(1, Math.floor(maxRetries))),
      selection: 'best_overall',
    },
    criteria: criteriaWithOverride.length ? criteriaWithOverride : fallback.criteria,
  };
}

function readYt2bpContentSafetyConfig(): Yt2bpContentSafetyConfig {
  const fallback: Yt2bpContentSafetyConfig = {
    enabled: true,
    judge_model: 'o4-mini',
    prompt_version: 'yt2bp_content_safety_v0',
    retry_policy: { max_retries: 1, selection: 'first_pass' },
    criteria: [
      { id: 'self_harm', text: 'No encouragement, planning, or reinforcement of self-harm/suicide.', required: true },
      { id: 'sexual_minors', text: 'No sexual content involving minors or underage persons.', required: true },
      { id: 'hate_harassment', text: 'No targeted hate, dehumanization, or harassment against protected groups.', required: true },
    ],
  };

  const configPath = path.join(process.cwd(), 'eval', 'methods', 'v0', 'llm_content_safety_grading_v0', 'global_pack_v0.json');
  let loaded = fallback;
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      loaded = {
        ...fallback,
        ...parsed,
        retry_policy: { ...fallback.retry_policy, ...(parsed?.retry_policy || {}) },
        criteria: Array.isArray(parsed?.criteria) ? parsed.criteria : fallback.criteria,
      };
    } catch {
      loaded = fallback;
    }
  }

  const envEnabledRaw = String(process.env.YT2BP_CONTENT_SAFETY_ENABLED ?? '').trim().toLowerCase();
  const enabled =
    envEnabledRaw === ''
      ? Boolean(loaded.enabled)
      : !(envEnabledRaw === '0' || envEnabledRaw === 'false' || envEnabledRaw === 'off' || envEnabledRaw === 'no');
  const envModel = String(process.env.YT2BP_CONTENT_SAFETY_MODEL || '').trim();
  const envRetryRaw = Number(process.env.YT2BP_CONTENT_SAFETY_MAX_RETRIES);
  const maxRetriesBase = Number(loaded.retry_policy?.max_retries ?? 1);
  const maxRetries = Number.isFinite(envRetryRaw) ? envRetryRaw : maxRetriesBase;

  const criteria = (loaded.criteria || [])
    .map((c) => ({
      id: String(c?.id || '').trim(),
      text: String(c?.text || '').trim(),
      required: Boolean(c?.required),
    }))
    .filter((c) => c.id && c.text);

  return {
    enabled,
    judge_model: envModel || String(loaded.judge_model || fallback.judge_model),
    prompt_version: String(loaded.prompt_version || fallback.prompt_version),
    retry_policy: { max_retries: Math.max(0, Math.min(3, Math.floor(maxRetries))), selection: 'first_pass' },
    criteria: criteria.length ? criteria : fallback.criteria,
  };
}

function buildYt2bpQualityJudgeInput(draft: YouTubeDraft, config: Yt2bpQualityConfig) {
  const criteriaLines = config.criteria
    .map((c) => `- ${c.id}: ${c.text} (required=${c.required}, min_score=${c.min_score})`)
    .join('\n');
  return [
    'Grade this blueprint quality.',
    `Scale: ${config.scale.min}..${config.scale.max}`,
    `PromptVersion: ${config.prompt_version}`,
    '',
    'Criteria:',
    criteriaLines,
    '',
    'Blueprint JSON:',
    JSON.stringify(draft, null, 2),
    '',
    'Return ONLY strict JSON:',
    '{"scores":[{"id":"criterion_id","score":0}],"overall":0}',
  ].join('\n');
}

async function scoreYt2bpQualityWithOpenAI(
  draft: YouTubeDraft,
  config: Yt2bpQualityConfig
): Promise<{
  ok: boolean;
  overall: number;
  scores: Array<{ id: string; score: number; min_score: number; required: boolean; pass: boolean }>;
  failures: string[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: config.judge_model,
    instructions: [
      'You are a strict JSON generator.',
      'Do not include markdown.',
      'Output only JSON with fields: scores, overall.',
    ].join('\n'),
    input: buildYt2bpQualityJudgeInput(draft, config),
  });

  const outputText = String(response.output_text || '').trim();
  if (!outputText) throw new Error('No output text from quality judge');
  let jsonText = outputText;
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
  jsonText = jsonText.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Quality judge output is not valid JSON');
  }

  const judged = QualityJudgeResponseSchema.parse(parsed);
  const expectedIds = config.criteria.map((c) => c.id).sort();
  const actualIds = judged.scores.map((s) => s.id).sort();
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((id, i) => id !== actualIds[i])
  ) {
    throw new Error('Quality judge criterion id mismatch');
  }

  const scoreMap = new Map(judged.scores.map((s) => [s.id, Number(s.score)]));
  const clamp = (n: number) => Math.max(config.scale.min, Math.min(config.scale.max, n));

  const scores = config.criteria.map((criterion) => {
    const score = clamp(Number(scoreMap.get(criterion.id) ?? config.scale.min));
    const pass = !criterion.required || score >= criterion.min_score;
    return {
      id: criterion.id,
      score,
      min_score: criterion.min_score,
      required: criterion.required,
      pass,
    };
  });
  const failures = scores.filter((s) => !s.pass).map((s) => s.id);
  const overall = Number.isFinite(Number(judged.overall))
    ? clamp(Number(judged.overall))
    : scores.reduce((sum, s) => sum + s.score, 0) / Math.max(1, scores.length);
  return { ok: failures.length === 0, overall, scores, failures };
}

function buildYt2bpContentSafetyJudgeInput(draft: YouTubeDraft, config: Yt2bpContentSafetyConfig) {
  const criteriaLines = config.criteria
    .map((c) => `- ${c.id}: ${c.text}`)
    .join('\n');
  return [
    'You are evaluating generated content safety.',
    `PromptVersion: ${config.prompt_version}`,
    '',
    'Mark each criterion pass=true only if the content is safe for that criterion.',
    'If any criterion fails, blocked must be true.',
    '',
    'Criteria:',
    criteriaLines,
    '',
    'Blueprint JSON:',
    JSON.stringify(draft, null, 2),
    '',
    'Return ONLY strict JSON in this shape:',
    '{"criteria":[{"id":"criterion_id","pass":true,"rationale":"optional"}],"blocked":false}',
  ].join('\n');
}

async function scoreYt2bpContentSafetyWithOpenAI(
  draft: YouTubeDraft,
  config: Yt2bpContentSafetyConfig
): Promise<{
  ok: boolean;
  blocked: boolean;
  failedCriteria: string[];
  details: Array<{ id: string; pass: boolean; rationale?: string }>;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: config.judge_model,
    instructions: [
      'You are a strict JSON generator.',
      'Return only JSON.',
    ].join('\n'),
    input: buildYt2bpContentSafetyJudgeInput(draft, config),
  });

  const outputText = String(response.output_text || '').trim();
  if (!outputText) throw new Error('No output text from content safety judge');
  let jsonText = outputText;
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
  jsonText = jsonText.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Content safety judge output is not valid JSON');
  }
  const judged = ContentSafetyJudgeResponseSchema.parse(parsed);

  const expectedIds = config.criteria.map((c) => c.id).sort();
  const actualIds = judged.criteria.map((c) => c.id).sort();
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((id, i) => id !== actualIds[i])
  ) {
    throw new Error('Content safety criterion id mismatch');
  }

  const failedCriteria = judged.criteria.filter((c) => !c.pass).map((c) => c.id);
  const blocked = Boolean(judged.blocked) || failedCriteria.length > 0;
  return { ok: !blocked, blocked, failedCriteria, details: judged.criteria };
}


app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/credits', (_req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json(getCredits(userId));
});

app.post('/api/generate-inventory', async (req, res) => {
  const parsed = InventoryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const payload: InventoryRequest = parsed.data;
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const creditCheck = consumeCredit(userId);
  if (!creditCheck.ok) {
    if (creditCheck.reason === 'global') {
      return res.status(429).json({
        error: 'We’re at capacity right now. Please try again in a few minutes.',
        retryAfterSeconds: creditCheck.retryAfterSeconds,
      });
    }
    return res.status(429).json({
      error: 'Daily AI credits used. Please try again tomorrow.',
      remaining: creditCheck.remaining,
      limit: creditCheck.limit,
      resetAt: creditCheck.resetAt,
    });
  }

  try {
    const client = createLLMClient();
    const schema = await client.generateInventory(payload);
    return res.json(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/analyze-blueprint', async (req, res) => {
  const parsed = BlueprintReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const creditCheck = consumeCredit(userId);
  if (!creditCheck.ok) {
    if (creditCheck.reason === 'global') {
      return res.status(429).json({
        error: 'We’re at capacity right now. Please try again in a few minutes.',
        retryAfterSeconds: creditCheck.retryAfterSeconds,
      });
    }
    return res.status(429).json({
      error: 'Daily AI credits used. Please try again tomorrow.',
      remaining: creditCheck.remaining,
      limit: creditCheck.limit,
      resetAt: creditCheck.resetAt,
    });
  }

  const normalizedItems: Record<string, BlueprintSelectedItem[]> = {};
  Object.entries(parsed.data.selectedItems).forEach(([category, items]) => {
    const normalized = items.map((item) => {
      if (typeof item === 'string') {
        return { name: item };
      }
      return { name: item.name, context: item.context };
    });
    normalizedItems[category] = normalized;
  });

  const payload: BlueprintAnalysisRequest = {
    title: parsed.data.title,
    inventoryTitle: parsed.data.inventoryTitle,
    selectedItems: normalizedItems,
    mixNotes: parsed.data.mixNotes,
    reviewPrompt: parsed.data.reviewPrompt,
    reviewSections: parsed.data.reviewSections,
    includeScore: parsed.data.includeScore,
  };

  try {
    const client = createLLMClient();
    const review = await client.analyzeBlueprint(payload);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chunkSize = 200;
    for (let i = 0; i < review.length; i += chunkSize) {
      const chunk = review.slice(i, i + chunkSize);
      const frame = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
      res.write(`data: ${frame}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/generate-blueprint', async (req, res) => {
  const parsed = BlueprintGenerationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const creditCheck = consumeCredit(userId);
  if (!creditCheck.ok) {
    if (creditCheck.reason === 'global') {
      return res.status(429).json({
        error: 'We’re at capacity right now. Please try again in a few minutes.',
        retryAfterSeconds: creditCheck.retryAfterSeconds,
      });
    }
    return res.status(429).json({
      error: 'Daily AI credits used. Please try again tomorrow.',
      remaining: creditCheck.remaining,
      limit: creditCheck.limit,
      resetAt: creditCheck.resetAt,
    });
  }

  const payload: BlueprintGenerationRequest = {
    title: parsed.data.title?.trim() || undefined,
    description: parsed.data.description?.trim() || undefined,
    notes: parsed.data.notes?.trim() || undefined,
    inventoryTitle: parsed.data.inventoryTitle.trim(),
    categories: parsed.data.categories.map((category) => ({
      name: category.name.trim(),
      items: category.items.map((item) => item.trim()).filter(Boolean),
    })).filter((category) => category.items.length > 0),
  };

  try {
    const client = createLLMClient();
    const generated = await client.generateBlueprint(payload);
    const normalized = normalizeGeneratedBlueprint(payload, generated);
    if (!normalized.steps.length) {
      return res.status(500).json({ error: 'Generated blueprint had no usable steps.' });
    }
    return res.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/youtube-to-blueprint', yt2bpIpHourlyLimiter, yt2bpAnonLimiter, yt2bpAuthLimiter, async (req, res) => {
  if (!yt2bpEnabled) {
    res.locals.bucketErrorCode = 'SERVICE_DISABLED';
    return res.status(503).json({
      ok: false,
      error_code: 'SERVICE_DISABLED',
      message: 'YouTube to Blueprint is temporarily unavailable. Please try again later.',
      run_id: null,
    });
  }

  const parsed = YouTubeToBlueprintRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'INVALID_URL',
      message: 'Invalid request payload.',
      run_id: null,
    });
  }

  const runId = `yt2bp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adapter = getAdapterForUrl(parsed.data.video_url);
  if (!adapter) {
    return res.status(400).json({
      ok: false,
      error_code: 'INVALID_URL',
      message: 'Only YouTube URLs are supported.',
      run_id: runId,
    });
  }
  const validatedUrl = adapter.validate(parsed.data.video_url);
  if (!validatedUrl.ok) {
    return res.status(400).json({
      ok: false,
      error_code: validatedUrl.errorCode,
      message: validatedUrl.message,
      run_id: runId,
    });
  }

  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (userId) {
    const creditCheck = consumeCredit(userId);
    if (!creditCheck.ok) {
      return res.status(429).json({
        ok: false,
        error_code: 'GENERATION_FAIL',
        message: creditCheck.reason === 'global'
          ? 'We’re at capacity right now. Please try again in a few minutes.'
          : 'Daily AI credits used. Please try again tomorrow.',
        run_id: runId,
      });
    }
  }

  try {
    const result = await withTimeout(
      runYouTubePipeline({
        runId,
        videoId: validatedUrl.sourceNativeId,
        videoUrl: parsed.data.video_url,
        generateReview: parsed.data.generate_review,
        generateBanner: parsed.data.generate_banner,
        authToken,
      }),
      120_000
    );
    return res.json(result);
  } catch (error) {
    const known = mapPipelineError(error);
    if (known) {
      res.locals.bucketErrorCode = known.error_code;
      const status =
        known.error_code === 'TIMEOUT' ? 504
          : known.error_code === 'INVALID_URL' ? 400
            : known.error_code === 'NO_CAPTIONS' || known.error_code === 'TRANSCRIPT_EMPTY' ? 422
              : known.error_code === 'PROVIDER_FAIL' ? 502
                : known.error_code === 'PII_BLOCKED' || known.error_code === 'SAFETY_BLOCKED' ? 422
                  : known.error_code === 'RATE_LIMITED' ? 429
                : 500;
      return res.status(status).json({
        ok: false,
        ...known,
        run_id: runId,
      });
    }
    const message = error instanceof Error ? error.message : 'Could not complete YouTube blueprint.';
    return res.status(500).json({
      ok: false,
      error_code: 'GENERATION_FAIL',
      message,
      run_id: runId,
    });
  }
});

function getAuthedSupabaseClient(authToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  });
}

function getServiceSupabaseClient() {
  if (!supabaseUrl) return null;
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function isServiceRequestAuthorized(req: express.Request) {
  if (!ingestionServiceToken) return false;
  const fromHeader = String(req.header('x-service-token') || '').trim();
  const fromBearer = String(req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return fromHeader === ingestionServiceToken || fromBearer === ingestionServiceToken;
}

function toTagSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function ensureTagId(db: ReturnType<typeof createClient>, userId: string, tagSlug: string): Promise<string> {
  const slug = toTagSlug(tagSlug);
  if (!slug) throw new Error('INVALID_TAG');

  const { data: existing } = await db.from('tags').select('id').eq('slug', slug).maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await db
    .from('tags')
    .insert({ slug, created_by: userId })
    .select('id')
    .single();
  if (error) {
    const { data: retry } = await db.from('tags').select('id').eq('slug', slug).maybeSingle();
    if (retry?.id) return retry.id;
    throw error;
  }
  return created.id;
}

function mapDraftStepsForBlueprint(steps: Array<{ name: string; notes: string }>) {
  return steps.map((step, index) => ({
    id: `yt-sub-step-${index + 1}`,
    title: step.name,
    description: step.notes,
    items: [],
  }));
}

async function upsertSourceItemFromVideo(db: ReturnType<typeof createClient>, input: {
  video: YouTubeFeedVideo;
  channelId: string;
  channelTitle: string | null;
}) {
  const canonicalKey = `youtube:${input.video.videoId}`;
  const { data, error } = await db
    .from('source_items')
    .upsert(
      {
        source_type: 'youtube',
        source_native_id: input.video.videoId,
        canonical_key: canonicalKey,
        source_url: input.video.url,
        title: input.video.title,
        published_at: input.video.publishedAt,
        ingest_status: 'ready',
        source_channel_id: input.channelId,
        source_channel_title: input.channelTitle,
        thumbnail_url: input.video.thumbnailUrl,
        metadata: {
          provider: 'youtube_rss',
        },
      },
      { onConflict: 'canonical_key' },
    )
    .select('id, source_url, source_native_id')
    .single();
  if (error) throw error;
  return data;
}

async function getExistingFeedItem(db: ReturnType<typeof createClient>, userId: string, sourceItemId: string) {
  const { data, error } = await db
    .from('user_feed_items')
    .select('id, state, blueprint_id')
    .eq('user_id', userId)
    .eq('source_item_id', sourceItemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function insertFeedItem(db: ReturnType<typeof createClient>, input: {
  userId: string;
  sourceItemId: string;
  blueprintId: string | null;
  state: string;
}) {
  const { data, error } = await db
    .from('user_feed_items')
    .insert({
      user_id: input.userId,
      source_item_id: input.sourceItemId,
      blueprint_id: input.blueprintId,
      state: input.state,
      last_decision_code: null,
    })
    .select('id')
    .single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') return null;
    throw error;
  }
  return data;
}

async function createBlueprintFromVideo(db: ReturnType<typeof createClient>, input: {
  userId: string;
  videoUrl: string;
  videoId: string;
  sourceTag: 'subscription_auto' | 'subscription_accept';
}) {
  const runId = `sub-${input.sourceTag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await runYouTubePipeline({
    runId,
    videoId: input.videoId,
    videoUrl: input.videoUrl,
    generateReview: false,
    generateBanner: false,
    authToken: '',
  });

  const { data: blueprint, error: blueprintError } = await db
    .from('blueprints')
    .insert({
      title: result.draft.title,
      creator_user_id: input.userId,
      is_public: false,
      steps: mapDraftStepsForBlueprint(result.draft.steps),
      selected_items: {
        source: input.sourceTag,
        run_id: result.run_id,
        video_url: input.videoUrl,
      },
      mix_notes: result.draft.notes || null,
      llm_review: result.review.summary || null,
    })
    .select('id')
    .single();
  if (blueprintError) throw blueprintError;

  for (const rawTag of result.draft.tags || []) {
    const tagSlug = toTagSlug(rawTag);
    if (!tagSlug) continue;
    const tagId = await ensureTagId(db, input.userId, tagSlug);
    await db
      .from('blueprint_tags')
      .upsert({ blueprint_id: blueprint.id, tag_id: tagId }, { onConflict: 'blueprint_id,tag_id' });
  }

  return {
    blueprintId: blueprint.id,
    runId: result.run_id,
    title: result.draft.title,
  };
}

type SyncSubscriptionResult = {
  processed: number;
  inserted: number;
  skipped: number;
  newestVideoId: string | null;
  newestPublishedAt: string | null;
  channelTitle: string | null;
};

async function syncSingleSubscription(db: ReturnType<typeof createClient>, subscription: {
  id: string;
  user_id: string;
  mode: string;
  source_channel_id: string;
  last_seen_published_at: string | null;
  last_seen_video_id: string | null;
}, options: {
  trigger: 'user_sync' | 'service_cron' | 'subscription_create';
}) {
  const mode = subscription.mode === 'auto' ? 'auto' : 'manual';
  const feed = await fetchYouTubeFeed(subscription.source_channel_id, 20);
  const newest = feed.videos[0] || null;

  let candidates: YouTubeFeedVideo[] = [];
  if (!subscription.last_seen_published_at) {
    if (mode === 'manual') {
      candidates = feed.videos.slice(0, manualBackfillLimit);
    } else {
      candidates = [];
    }
  } else {
    candidates = feed.videos.filter((video) =>
      isNewerThanCheckpoint(video, subscription.last_seen_published_at, subscription.last_seen_video_id),
    );
  }

  const toProcess = candidates
    .slice(0, ingestionMaxPerSubscription)
    .sort((a, b) => {
      const aTs = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTs = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return aTs - bTs;
    });

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  for (const video of toProcess) {
    processed += 1;
    const source = await upsertSourceItemFromVideo(db, {
      video,
      channelId: subscription.source_channel_id,
      channelTitle: feed.channelTitle,
    });

    const existingFeedItem = await getExistingFeedItem(db, subscription.user_id, source.id);
    if (existingFeedItem) {
      skipped += 1;
      continue;
    }

    if (mode === 'manual') {
      const pending = await insertFeedItem(db, {
        userId: subscription.user_id,
        sourceItemId: source.id,
        blueprintId: null,
        state: 'my_feed_pending_accept',
      });
      if (pending) inserted += 1;
      else skipped += 1;
      continue;
    }

    const generated = await createBlueprintFromVideo(db, {
      userId: subscription.user_id,
      videoUrl: source.source_url,
      videoId: source.source_native_id,
      sourceTag: 'subscription_auto',
    });

    const insertedItem = await insertFeedItem(db, {
      userId: subscription.user_id,
      sourceItemId: source.id,
      blueprintId: generated.blueprintId,
      state: 'my_feed_published',
    });
    if (insertedItem) inserted += 1;
    else skipped += 1;

    console.log('[subscription_auto_ingested]', JSON.stringify({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      source_item_id: source.id,
      blueprint_id: generated.blueprintId,
      trigger: options.trigger,
      run_id: generated.runId,
    }));
  }

  await db
    .from('user_source_subscriptions')
    .update({
      source_channel_title: feed.channelTitle,
      last_polled_at: new Date().toISOString(),
      last_seen_published_at: newest?.publishedAt || subscription.last_seen_published_at,
      last_seen_video_id: newest?.videoId || subscription.last_seen_video_id,
      last_sync_error: null,
    })
    .eq('id', subscription.id);

  return {
    processed,
    inserted,
    skipped,
    newestVideoId: newest?.videoId || null,
    newestPublishedAt: newest?.publishedAt || null,
    channelTitle: feed.channelTitle,
  } as SyncSubscriptionResult;
}

async function markSubscriptionSyncError(db: ReturnType<typeof createClient>, subscriptionId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await db
    .from('user_source_subscriptions')
    .update({
      last_polled_at: new Date().toISOString(),
      last_sync_error: message.slice(0, 500),
    })
    .eq('id', subscriptionId);
}

app.post('/api/source-subscriptions', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });
  }

  const body = req.body as { channel_input?: string; mode?: string };
  const channelInput = String(body.channel_input || '').trim();
  const mode = String(body.mode || 'manual').trim().toLowerCase();
  if (!channelInput || (mode !== 'manual' && mode !== 'auto')) {
    return res.status(400).json({ ok: false, error_code: 'INVALID_INPUT', message: 'channel_input and valid mode required', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  let resolved;
  try {
    resolved = await resolveYouTubeChannel(channelInput);
  } catch {
    return res.status(400).json({ ok: false, error_code: 'INVALID_CHANNEL', message: 'Could not resolve YouTube channel', data: null });
  }

  const { data: upserted, error: upsertError } = await db
    .from('user_source_subscriptions')
    .upsert(
      {
        user_id: userId,
        source_type: 'youtube',
        source_channel_id: resolved.channelId,
        source_channel_url: resolved.channelUrl,
        source_channel_title: resolved.channelTitle,
        mode,
        is_active: true,
        last_sync_error: null,
      },
      { onConflict: 'user_id,source_type,source_channel_id' },
    )
    .select('id, user_id, source_type, source_channel_id, source_channel_url, source_channel_title, mode, is_active, last_polled_at, last_seen_published_at, last_seen_video_id, last_sync_error, created_at, updated_at')
    .single();
  if (upsertError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: upsertError.message, data: null });

  let sync: SyncSubscriptionResult | null = null;
  try {
    sync = await syncSingleSubscription(db, upserted, { trigger: 'subscription_create' });
  } catch (error) {
    await markSubscriptionSyncError(db, upserted.id, error);
  }

  return res.json({
    ok: true,
    error_code: null,
    message: 'subscription upserted',
    data: {
      subscription: upserted,
      sync,
    },
  });
});

app.get('/api/source-subscriptions', async (_req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data, error } = await db
    .from('user_source_subscriptions')
    .select('id, user_id, source_type, source_channel_id, source_channel_url, source_channel_title, mode, is_active, last_polled_at, last_seen_published_at, last_seen_video_id, last_sync_error, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: error.message, data: null });

  return res.json({
    ok: true,
    error_code: null,
    message: 'subscriptions fetched',
    data,
  });
});

app.patch('/api/source-subscriptions/:id', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });
  }

  const modeRaw = req.body?.mode;
  const isActiveRaw = req.body?.is_active;
  const updates: Record<string, unknown> = {};
  if (typeof modeRaw === 'string') {
    const mode = modeRaw.trim().toLowerCase();
    if (mode !== 'manual' && mode !== 'auto') {
      return res.status(400).json({ ok: false, error_code: 'INVALID_INPUT', message: 'Invalid mode', data: null });
    }
    updates.mode = mode;
  }
  if (typeof isActiveRaw === 'boolean') {
    updates.is_active = isActiveRaw;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ ok: false, error_code: 'INVALID_INPUT', message: 'No valid fields to update', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data, error } = await db
    .from('user_source_subscriptions')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .select('id, user_id, source_type, source_channel_id, source_channel_url, source_channel_title, mode, is_active, last_polled_at, last_seen_published_at, last_seen_video_id, last_sync_error, created_at, updated_at')
    .maybeSingle();
  if (error) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: error.message, data: null });
  if (!data) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Subscription not found', data: null });

  return res.json({
    ok: true,
    error_code: null,
    message: 'subscription updated',
    data,
  });
});

app.delete('/api/source-subscriptions/:id', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data, error } = await db
    .from('user_source_subscriptions')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: error.message, data: null });
  if (!data) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Subscription not found', data: null });

  return res.json({
    ok: true,
    error_code: null,
    message: 'subscription deactivated',
    data,
  });
});

app.post('/api/source-subscriptions/:id/sync', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data: subscription, error: subscriptionError } = await db
    .from('user_source_subscriptions')
    .select('id, user_id, mode, source_channel_id, last_seen_published_at, last_seen_video_id, is_active')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (subscriptionError) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: subscriptionError.message, data: null });
  if (!subscription) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Subscription not found', data: null });
  if (!subscription.is_active) return res.status(400).json({ ok: false, error_code: 'INACTIVE_SUBSCRIPTION', message: 'Subscription is inactive', data: null });

  const { data: job, error: jobCreateError } = await db
    .from('ingestion_jobs')
    .insert({
      trigger: 'user_sync',
      scope: 'subscription',
      status: 'running',
      requested_by_user_id: userId,
      subscription_id: subscription.id,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (jobCreateError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: jobCreateError.message, data: null });

  try {
    const sync = await syncSingleSubscription(db, subscription, { trigger: 'user_sync' });
    await db.from('ingestion_jobs').update({
      status: 'succeeded',
      finished_at: new Date().toISOString(),
      processed_count: sync.processed,
      inserted_count: sync.inserted,
      skipped_count: sync.skipped,
      error_code: null,
      error_message: null,
    }).eq('id', job.id);

    return res.json({
      ok: true,
      error_code: null,
      message: 'subscription sync complete',
      data: {
        job_id: job.id,
        ...sync,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSubscriptionSyncError(db, subscription.id, error);
    await db.from('ingestion_jobs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_code: 'SYNC_FAILED',
      error_message: message.slice(0, 500),
    }).eq('id', job.id);
    return res.status(500).json({ ok: false, error_code: 'SYNC_FAILED', message, data: { job_id: job.id } });
  }
});

app.post('/api/ingestion/jobs/trigger', async (req, res) => {
  if (!isServiceRequestAuthorized(req)) {
    return res.status(401).json({ ok: false, error_code: 'SERVICE_AUTH_REQUIRED', message: 'Missing or invalid service token', data: null });
  }
  const db = getServiceSupabaseClient();
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Service role client not configured', data: null });

  const { data: job, error: jobCreateError } = await db
    .from('ingestion_jobs')
    .insert({
      trigger: 'service_cron',
      scope: 'all_active_subscriptions',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (jobCreateError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: jobCreateError.message, data: null });

  const { data: subscriptions, error: subscriptionsError } = await db
    .from('user_source_subscriptions')
    .select('id, user_id, mode, source_channel_id, last_seen_published_at, last_seen_video_id, is_active')
    .eq('is_active', true)
    .eq('source_type', 'youtube')
    .order('updated_at', { ascending: false });

  if (subscriptionsError) {
    await db.from('ingestion_jobs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_code: 'READ_FAILED',
      error_message: subscriptionsError.message,
    }).eq('id', job.id);
    return res.status(500).json({ ok: false, error_code: 'READ_FAILED', message: subscriptionsError.message, data: { job_id: job.id } });
  }

  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  const failures: Array<{ subscription_id: string; error: string }> = [];

  for (const subscription of subscriptions || []) {
    try {
      const sync = await syncSingleSubscription(db, subscription, { trigger: 'service_cron' });
      processed += sync.processed;
      inserted += sync.inserted;
      skipped += sync.skipped;
    } catch (error) {
      failures.push({
        subscription_id: subscription.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await markSubscriptionSyncError(db, subscription.id, error);
    }
  }

  await db.from('ingestion_jobs').update({
    status: failures.length ? 'failed' : 'succeeded',
    finished_at: new Date().toISOString(),
    processed_count: processed,
    inserted_count: inserted,
    skipped_count: skipped,
    error_code: failures.length ? 'PARTIAL_FAILURE' : null,
    error_message: failures.length ? JSON.stringify(failures).slice(0, 1000) : null,
  }).eq('id', job.id);

  return res.status(failures.length ? 207 : 200).json({
    ok: true,
    error_code: failures.length ? 'PARTIAL_FAILURE' : null,
    message: 'ingestion trigger complete',
    data: {
      job_id: job.id,
      subscriptions_total: (subscriptions || []).length,
      processed,
      inserted,
      skipped,
      failures,
    },
  });
});

app.post('/api/my-feed/items/:id/accept', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const feedItemId = req.params.id;
  const { data: feedItem, error: readError } = await db
    .from('user_feed_items')
    .select('id, user_id, source_item_id, blueprint_id, state')
    .eq('id', feedItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: readError.message, data: null });
  if (!feedItem) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Feed item not found', data: null });

  if (feedItem.blueprint_id && feedItem.state === 'my_feed_published') {
    return res.json({
      ok: true,
      error_code: null,
      message: 'item already accepted',
      data: {
        user_feed_item_id: feedItem.id,
        blueprint_id: feedItem.blueprint_id,
        state: feedItem.state,
      },
    });
  }

  if (!['my_feed_pending_accept', 'my_feed_skipped'].includes(feedItem.state)) {
    return res.status(409).json({
      ok: false,
      error_code: 'INVALID_STATE',
      message: `Cannot accept item in state ${feedItem.state}`,
      data: null,
    });
  }

  const { data: lockRow, error: lockError } = await db
    .from('user_feed_items')
    .update({ state: 'my_feed_generating', last_decision_code: null })
    .eq('id', feedItem.id)
    .eq('user_id', userId)
    .eq('state', feedItem.state)
    .select('id')
    .maybeSingle();
  if (lockError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: lockError.message, data: null });
  if (!lockRow) {
    return res.status(409).json({ ok: false, error_code: 'LOCK_FAILED', message: 'Item is being processed by another request', data: null });
  }

  const { data: sourceRow, error: sourceError } = await db
    .from('source_items')
    .select('id, source_url, source_native_id')
    .eq('id', feedItem.source_item_id)
    .maybeSingle();
  if (sourceError || !sourceRow) {
    await db.from('user_feed_items').update({ state: 'my_feed_pending_accept', last_decision_code: 'SOURCE_MISSING' }).eq('id', feedItem.id);
    return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: sourceError?.message || 'Source item missing', data: null });
  }

  try {
    const generated = await createBlueprintFromVideo(db, {
      userId,
      videoUrl: sourceRow.source_url,
      videoId: sourceRow.source_native_id,
      sourceTag: 'subscription_accept',
    });

    await db.from('user_feed_items').update({
      blueprint_id: generated.blueprintId,
      state: 'my_feed_published',
      last_decision_code: null,
    }).eq('id', feedItem.id).eq('user_id', userId);

    console.log('[my_feed_pending_accepted]', JSON.stringify({
      user_feed_item_id: feedItem.id,
      source_item_id: sourceRow.id,
      blueprint_id: generated.blueprintId,
      run_id: generated.runId,
    }));

    return res.json({
      ok: true,
      error_code: null,
      message: 'item accepted and generated',
      data: {
        user_feed_item_id: feedItem.id,
        blueprint_id: generated.blueprintId,
        state: 'my_feed_published',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('user_feed_items').update({
      state: 'my_feed_pending_accept',
      last_decision_code: 'GENERATION_FAILED',
    }).eq('id', feedItem.id).eq('user_id', userId);

    return res.status(500).json({
      ok: false,
      error_code: 'GENERATION_FAILED',
      message,
      data: {
        user_feed_item_id: feedItem.id,
      },
    });
  }
});

app.post('/api/my-feed/items/:id/skip', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data, error } = await db
    .from('user_feed_items')
    .update({ state: 'my_feed_skipped', last_decision_code: 'SKIPPED_BY_USER' })
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .eq('state', 'my_feed_pending_accept')
    .select('id, state')
    .maybeSingle();
  if (error) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: error.message, data: null });
  if (!data) return res.status(409).json({ ok: false, error_code: 'INVALID_STATE', message: 'Only pending items can be skipped', data: null });

  return res.json({
    ok: true,
    error_code: null,
    message: 'item skipped',
    data: {
      user_feed_item_id: data.id,
      state: data.state,
    },
  });
});

app.post('/api/channel-candidates', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const body = req.body as { user_feed_item_id?: string; channel_slug?: string };
  const userFeedItemId = String(body.user_feed_item_id || '').trim();
  const channelSlug = String(body.channel_slug || '').trim();
  if (!userFeedItemId || !channelSlug) {
    return res.status(400).json({ ok: false, error_code: 'INVALID_INPUT', message: 'user_feed_item_id and channel_slug required', data: null });
  }

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const { data, error } = await db
    .from('channel_candidates')
    .upsert(
      {
        user_feed_item_id: userFeedItemId,
        channel_slug: channelSlug,
        submitted_by_user_id: userId,
        status: 'pending',
      },
      { onConflict: 'user_feed_item_id,channel_slug' },
    )
    .select('id, user_feed_item_id, channel_slug, status')
    .single();

  if (error) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: error.message, data: null });

  await db.from('user_feed_items').update({ state: 'candidate_submitted', last_decision_code: null }).eq('id', userFeedItemId);

  return res.json({
    ok: true,
    error_code: null,
    message: 'candidate upserted',
    data,
  });
});

app.get('/api/channel-candidates/:id', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const candidateId = req.params.id;
  const { data: candidate, error: candidateError } = await db
    .from('channel_candidates')
    .select('id, user_feed_item_id, channel_slug, status, created_at, updated_at')
    .eq('id', candidateId)
    .maybeSingle();

  if (candidateError) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: candidateError.message, data: null });
  if (!candidate) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Candidate not found', data: null });

  const { data: decisions } = await db
    .from('channel_gate_decisions')
    .select('gate_id, outcome, reason_code, score, policy_version, method_version, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  return res.json({
    ok: true,
    error_code: null,
    message: 'candidate status',
    data: {
      ...candidate,
      decisions: decisions || [],
    },
  });
});

app.post('/api/channel-candidates/:id/evaluate', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const candidateId = req.params.id;
  const { data: candidate, error: candidateError } = await db
    .from('channel_candidates')
    .select('id, user_feed_item_id, channel_slug, status')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateError) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: candidateError.message, data: null });
  if (!candidate) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: 'Candidate not found', data: null });

  const { data: feedItem, error: feedError } = await db
    .from('user_feed_items')
    .select('id, blueprint_id')
    .eq('id', candidate.user_feed_item_id)
    .maybeSingle();
  if (feedError || !feedItem) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: feedError?.message || 'Feed item missing', data: null });

  const { data: blueprint, error: blueprintError } = await db
    .from('blueprints')
    .select('id, title, llm_review, steps')
    .eq('id', feedItem.blueprint_id)
    .maybeSingle();
  if (blueprintError || !blueprint) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: blueprintError?.message || 'Blueprint missing', data: null });

  const { data: tagRows } = await db
    .from('blueprint_tags')
    .select('tags(slug)')
    .eq('blueprint_id', blueprint.id);
  const tagSlugs = (tagRows || [])
    .map((row) => (row.tags as { slug?: string } | null)?.slug || '')
    .filter(Boolean);

  const stepCount = Array.isArray(blueprint.steps) ? blueprint.steps.length : 0;
  const evaluation = evaluateCandidateForChannel({
    title: blueprint.title,
    llmReview: blueprint.llm_review,
    channelSlug: candidate.channel_slug,
    tagSlugs,
    stepCount,
  });

  const decisionsPayload = evaluation.decisions.map((decision) => ({
    candidate_id: candidate.id,
    gate_id: decision.gate_id,
    outcome: decision.outcome,
    reason_code: decision.reason_code,
    score: decision.score ?? null,
    policy_version: 'bleuv1-gate-policy-v1.0',
    method_version: decision.method_version || 'gate-v1',
  }));

  const { error: insertError } = await db.from('channel_gate_decisions').insert(decisionsPayload);
  if (insertError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: insertError.message, data: null });

  await db.from('channel_candidates').update({ status: evaluation.candidateStatus }).eq('id', candidate.id);
  await db
    .from('user_feed_items')
    .update({ state: evaluation.feedState, last_decision_code: evaluation.reasonCode })
    .eq('id', candidate.user_feed_item_id);

  console.log('[candidate_gate_result]', JSON.stringify({
    candidate_id: candidate.id,
    channel_slug: candidate.channel_slug,
    aggregate: evaluation.aggregate,
    reason_code: evaluation.reasonCode,
    execution_mode: 'all_gates_run',
    gate_mode: evaluation.mode,
    diagnostic_aggregate: evaluation.diagnosticAggregate || null,
    diagnostic_reason_code: evaluation.diagnosticReasonCode || null,
  }));
  if (evaluation.candidateStatus === 'pending_manual_review') {
    console.log('[candidate_manual_review_pending]', JSON.stringify({
      candidate_id: candidate.id,
      channel_slug: candidate.channel_slug,
      reason_code: evaluation.reasonCode,
      gate_mode: evaluation.mode,
    }));
  }

  return res.json({
    ok: true,
    error_code: null,
    message: 'candidate evaluated',
    data: {
      candidate_id: candidate.id,
      decision: evaluation.aggregate,
      next_state: evaluation.feedState,
      reason_code: evaluation.reasonCode,
    },
    meta: {
      execution_mode: 'all_gates_run',
      gate_mode: evaluation.mode,
      diagnostic_aggregate: evaluation.diagnosticAggregate || null,
      diagnostic_reason_code: evaluation.diagnosticReasonCode || null,
    },
  });
});

app.post('/api/channel-candidates/:id/publish', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const candidateId = req.params.id;
  const body = req.body as { tag_slug?: string };

  const { data: candidate, error: candidateError } = await db
    .from('channel_candidates')
    .select('id, user_feed_item_id, channel_slug, status')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateError || !candidate) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: candidateError?.message || 'Candidate not found', data: null });

  const { data: feedItem, error: feedError } = await db
    .from('user_feed_items')
    .select('id, blueprint_id')
    .eq('id', candidate.user_feed_item_id)
    .maybeSingle();
  if (feedError || !feedItem) return res.status(400).json({ ok: false, error_code: 'READ_FAILED', message: feedError?.message || 'Feed item missing', data: null });

  const { error: publishError } = await db
    .from('blueprints')
    .update({ is_public: true })
    .eq('id', feedItem.blueprint_id);
  if (publishError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: publishError.message, data: null });

  const tagSlug = String(body.tag_slug || candidate.channel_slug || 'general').trim().toLowerCase();
  let tagId: string | null = null;
  const { data: existingTag } = await db.from('tags').select('id').eq('slug', tagSlug).maybeSingle();
  if (existingTag?.id) {
    tagId = existingTag.id;
  } else {
    const { data: createdTag, error: tagCreateError } = await db
      .from('tags')
      .insert({ slug: tagSlug, created_by: userId })
      .select('id')
      .single();
    if (tagCreateError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: tagCreateError.message, data: null });
    tagId = createdTag.id;
  }

  const { error: tagLinkError } = await db
    .from('blueprint_tags')
    .upsert({ blueprint_id: feedItem.blueprint_id, tag_id: tagId }, { onConflict: 'blueprint_id,tag_id' });
  if (tagLinkError) return res.status(400).json({ ok: false, error_code: 'WRITE_FAILED', message: tagLinkError.message, data: null });

  await db.from('channel_candidates').update({ status: 'published' }).eq('id', candidate.id);
  await db.from('user_feed_items').update({ state: 'channel_published', last_decision_code: 'ALL_GATES_PASS' }).eq('id', candidate.user_feed_item_id);

  console.log('[candidate_published]', JSON.stringify({
    candidate_id: candidate.id,
    user_feed_item_id: candidate.user_feed_item_id,
    blueprint_id: feedItem.blueprint_id,
    channel_slug: candidate.channel_slug,
    reason_code: 'ALL_GATES_PASS',
  }));

  return res.json({
    ok: true,
    error_code: null,
    message: 'candidate published',
    data: {
      candidate_id: candidate.id,
      published: true,
      channel_slug: candidate.channel_slug,
    },
  });
});

app.post('/api/channel-candidates/:id/reject', async (req, res) => {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) return res.status(401).json({ ok: false, error_code: 'AUTH_REQUIRED', message: 'Unauthorized', data: null });

  const db = getAuthedSupabaseClient(authToken);
  if (!db) return res.status(500).json({ ok: false, error_code: 'CONFIG_ERROR', message: 'Supabase not configured', data: null });

  const candidateId = req.params.id;
  const body = req.body as { reason_code?: string };
  const reasonCode = String(body.reason_code || 'MANUAL_REJECT').trim();

  const { data: candidate, error: candidateError } = await db
    .from('channel_candidates')
    .select('id, user_feed_item_id, channel_slug')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateError || !candidate) return res.status(404).json({ ok: false, error_code: 'NOT_FOUND', message: candidateError?.message || 'Candidate not found', data: null });

  const { data: feedItem } = await db
    .from('user_feed_items')
    .select('blueprint_id')
    .eq('id', candidate.user_feed_item_id)
    .maybeSingle();

  await db.from('channel_candidates').update({ status: 'rejected' }).eq('id', candidate.id);
  await db.from('user_feed_items').update({ state: 'channel_rejected', last_decision_code: reasonCode }).eq('id', candidate.user_feed_item_id);

  console.log('[candidate_rejected]', JSON.stringify({
    candidate_id: candidate.id,
    user_feed_item_id: candidate.user_feed_item_id,
    blueprint_id: feedItem?.blueprint_id || null,
    channel_slug: candidate.channel_slug,
    reason_code: reasonCode,
  }));

  return res.json({
    ok: true,
    error_code: null,
    message: 'candidate rejected',
    data: {
      candidate_id: candidate.id,
      reason_code: reasonCode,
    },
  });
});

function normalizeGeneratedBlueprint(
  request: BlueprintGenerationRequest,
  generated: BlueprintGenerationResult
) {
  const categoryMap = new Map<string, Set<string>>();
  request.categories.forEach((category) => {
    categoryMap.set(
      category.name,
      new Set(category.items.map((item) => item.trim()).filter(Boolean))
    );
  });

  const steps = (generated.steps || [])
    .map((step) => {
      const items = (step.items || [])
        .map((item) => ({
          category: item.category?.trim() || '',
          name: item.name?.trim() || '',
          context: item.context?.trim() || undefined,
        }))
        .filter((item) => {
          if (!item.category || !item.name) return false;
          const allowed = categoryMap.get(item.category);
          return !!allowed && allowed.has(item.name);
        });
      return {
        title: step.title?.trim() || 'Step',
        description: step.description?.trim() || '',
        items,
      };
    })
    .filter((step) => step.items.length > 0);

  return {
    title: generated.title?.trim() || request.title || request.inventoryTitle,
    steps,
  };
}

type PipelineErrorCode =
  | 'SERVICE_DISABLED'
  | 'INVALID_URL'
  | 'NO_CAPTIONS'
  | 'PROVIDER_FAIL'
  | 'TRANSCRIPT_EMPTY'
  | 'GENERATION_FAIL'
  | 'SAFETY_BLOCKED'
  | 'PII_BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT';

type PipelineErrorShape = {
  error_code: PipelineErrorCode;
  message: string;
};

class PipelineError extends Error {
  errorCode: PipelineErrorCode;
  constructor(errorCode: PipelineErrorCode, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

function makePipelineError(errorCode: PipelineErrorCode, message: string): never {
  throw new PipelineError(errorCode, message);
}

function mapPipelineError(error: unknown): PipelineErrorShape | null {
  if (error instanceof PipelineError) {
    return { error_code: error.errorCode, message: error.message };
  }
  if (error instanceof TranscriptProviderError) {
    if (error.code === 'TRANSCRIPT_FETCH_FAIL') {
      return { error_code: 'PROVIDER_FAIL', message: 'Transcript provider is currently unavailable. Please try another video.' };
    }
    return { error_code: error.code, message: error.message };
  }
  return null;
}

function flattenDraftText(draft: {
  title: string;
  description: string;
  notes?: string | null;
  tags?: string[];
  steps: Array<{ name: string; notes: string; timestamp?: string | null }>;
}) {
  const blocks = [
    draft.title,
    draft.description,
    draft.notes || '',
    ...(draft.tags || []),
    ...draft.steps.flatMap((step) => [step.name, step.notes, step.timestamp || '']),
  ];
  return blocks.filter(Boolean).join('\n').toLowerCase();
}

function runSafetyChecks(flattened: string) {
  const checks: Record<string, RegExp[]> = {
    self_harm: [/\bkill yourself\b/, /\bsuicide\b/, /\bself-harm\b/, /\bhow to self harm\b/],
    sexual_minors: [/\bminor\b.*\bsex/i, /\bchild\b.*\bsex/i, /\bunderage\b.*\bsexual/i],
    hate_harassment: [/\bkill (all|those)\b/, /\bsubhuman\b/, /\bgo back to your country\b/, /\bslur\b/],
  };
  const hits = Object.entries(checks)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(flattened)))
    .map(([key]) => key);
  return {
    ok: hits.length === 0,
    blockedTopics: hits,
  };
}

function runPiiChecks(flattened: string) {
  const checks = [
    { type: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
    { type: 'phone', regex: /\b(?:\+?\d{1,2}\s*)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}\b/ },
    { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  ];
  const hits = checks.filter((check) => check.regex.test(flattened)).map((check) => check.type);
  return { ok: hits.length === 0, matches: hits };
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new PipelineError('TIMEOUT', 'Request timed out.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function runYouTubePipeline(input: {
  runId: string;
  videoId: string;
  videoUrl: string;
  generateReview: boolean;
  generateBanner: boolean;
  authToken: string;
}) {
  const startedAt = Date.now();
  const transcript = await getTranscriptForVideo(input.videoId);
  const client = createLLMClient();
  const qualityConfig = readYt2bpQualityConfig();
  const contentSafetyConfig = readYt2bpContentSafetyConfig();
  const qualityAttempts = qualityConfig.enabled ? 1 + qualityConfig.retry_policy.max_retries : 1;
  const safetyRetryBudget = contentSafetyConfig.enabled ? contentSafetyConfig.retry_policy.max_retries : 0;
  let bestFailingQuality: {
    draft: YouTubeDraft;
    overall: number;
    failures: string[];
  } | null = null;
  const passingCandidates: Array<{ draft: YouTubeDraft; overall: number }> = [];

  const toDraft = (rawDraft: Awaited<ReturnType<typeof client.generateYouTubeBlueprint>>): YouTubeDraft => ({
    title: rawDraft.title?.trim() || 'YouTube Blueprint',
    description: rawDraft.description?.trim() || 'AI-generated blueprint from video transcript.',
    steps: (rawDraft.steps || [])
      .map((step) => ({
        name: step.name?.trim() || '',
        notes: step.notes?.trim() || '',
        timestamp: step.timestamp?.trim() || null,
      }))
      .filter((step) => step.name && step.notes),
    notes: rawDraft.notes?.trim() || null,
    tags: (rawDraft.tags || []).map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
  });

  let safetyRetriesUsed = 0;
  for (let attempt = 1; attempt <= qualityAttempts; attempt += 1) {
    let safetyRetryHint = '';
    let attemptRunCount = 0;
    const maxRunsForAttempt = 1 + safetyRetryBudget;
    while (attemptRunCount < maxRunsForAttempt) {
      attemptRunCount += 1;
      const globalRunIndex = (attempt - 1) * maxRunsForAttempt + attemptRunCount;
      const rawDraft = await client.generateYouTubeBlueprint({
        videoUrl: input.videoUrl,
        transcript: transcript.text,
        additionalInstructions: safetyRetryHint || undefined,
      });
      const draft = toDraft(rawDraft);

      if (!draft.steps.length) {
        console.log(
          `[yt2bp-quality] run_id=${input.runId} attempt=${attempt}/${qualityAttempts} run=${attemptRunCount}/${maxRunsForAttempt} global_run=${globalRunIndex} pass=false reason=no_steps`
        );
        break;
      }

      const flattened = flattenDraftText(draft);
      const deterministicSafety = runSafetyChecks(flattened);
      if (!deterministicSafety.ok) {
        makePipelineError('SAFETY_BLOCKED', `Forbidden topics detected: ${deterministicSafety.blockedTopics.join(', ')}`);
      }
      const pii = runPiiChecks(flattened);
      if (!pii.ok) {
        makePipelineError('PII_BLOCKED', `PII detected: ${pii.matches.join(', ')}`);
      }

      if (!qualityConfig.enabled) {
        passingCandidates.push({ draft, overall: 0 });
        break;
      }
      try {
        const graded = await scoreYt2bpQualityWithOpenAI(draft, qualityConfig);
        const failIds = graded.failures.join(',') || 'none';
        console.log(
          `[yt2bp-quality] run_id=${input.runId} attempt=${attempt}/${qualityAttempts} run=${attemptRunCount}/${maxRunsForAttempt} global_run=${globalRunIndex} pass=${graded.ok} overall=${graded.overall.toFixed(2)} failures=${failIds}`
        );
        if (!graded.ok) {
          if (!bestFailingQuality || graded.overall > bestFailingQuality.overall) {
            bestFailingQuality = { draft, overall: graded.overall, failures: graded.failures };
          }
          break;
        }

        let safetyPassed = !contentSafetyConfig.enabled;
        if (contentSafetyConfig.enabled) {
          const safetyScore = await scoreYt2bpContentSafetyWithOpenAI(draft, contentSafetyConfig);
          const flagged = safetyScore.failedCriteria.join(',') || 'none';
          console.log(
            `[yt2bp-content-safety] run_id=${input.runId} attempt=${attempt}/${qualityAttempts} run=${attemptRunCount}/${maxRunsForAttempt} global_run=${globalRunIndex} pass=${safetyScore.ok} flagged=${flagged}`
          );
          if (safetyScore.ok) {
            safetyPassed = true;
          } else if (safetyRetriesUsed < safetyRetryBudget && attemptRunCount < maxRunsForAttempt) {
            safetyRetriesUsed += 1;
            safetyRetryHint =
              'Avoid these forbidden topics: self_harm, sexual_minors, hate_harassment. Keep output safe and compliant.';
            continue;
          } else {
            makePipelineError('SAFETY_BLOCKED', 'This video content could not be converted safely. Please try another video.');
          }
        }

        if (safetyPassed) {
          passingCandidates.push({ draft, overall: graded.overall });
          break;
        }
      } catch (error) {
        if (error instanceof PipelineError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        const phase = message.toLowerCase().includes('safety') ? 'yt2bp-content-safety' : 'yt2bp-quality';
        console.log(
          `[${phase}] run_id=${input.runId} attempt=${attempt}/${qualityAttempts} run=${attemptRunCount}/${maxRunsForAttempt} pass=false judge_error=${message.slice(0, 180)}`
        );
        makePipelineError('GENERATION_FAIL', GENERIC_YT2BP_FAILURE_MESSAGE);
      }
    }
  }

  const selected = passingCandidates
    .slice()
    .sort((a, b) => b.overall - a.overall)[0];
  if (!selected) {
    if (bestFailingQuality) {
      console.log(
        `[yt2bp-quality] run_id=${input.runId} selected=none best_fail_overall=${bestFailingQuality.overall.toFixed(2)} fail_ids=${bestFailingQuality.failures.join(',')}`
      );
    }
    makePipelineError('GENERATION_FAIL', GENERIC_YT2BP_FAILURE_MESSAGE);
  }

  const draft = selected.draft;
  console.log(
    `[yt2bp] run_id=${input.runId} transcript_source=${transcript.source} transcript_chars=${transcript.text.length}`
  );

  let reviewSummary: string | null = null;
  if (input.generateReview) {
    const selectedItems = {
      transcript: draft.steps.map((step) => ({ name: step.name, context: step.timestamp || undefined })),
    };
    reviewSummary = await client.analyzeBlueprint({
      title: draft.title,
      inventoryTitle: 'YouTube transcript',
      selectedItems,
      mixNotes: draft.notes || undefined,
      reviewPrompt: 'Summarize quality and clarity in a concise way.',
      reviewSections: ['Overview', 'Strengths', 'Suggestions'],
      includeScore: true,
    });
  }

  let bannerUrl: string | null = null;
  if (input.generateBanner && input.authToken && supabaseUrl) {
    const banner = await client.generateBanner({
      title: draft.title,
      inventoryTitle: 'YouTube transcript',
      tags: draft.tags,
    });
    bannerUrl = await uploadBannerToSupabase(banner.buffer.toString('base64'), banner.mimeType, input.authToken);
  }

  return {
    ok: true,
    run_id: input.runId,
    draft,
    review: { available: input.generateReview, summary: reviewSummary },
    banner: { available: input.generateBanner, url: bannerUrl },
    meta: {
      transcript_source: transcript.source,
      confidence: transcript.confidence,
      duration_ms: Date.now() - startedAt,
    },
  };
}

async function uploadBannerToSupabase(imageBase64: string, contentType: string, authToken: string) {
  if (!supabaseUrl) return null;
  const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/upload-banner`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ contentType, imageBase64 }),
  });
  if (!uploadResponse.ok) {
    return null;
  }
  const uploadData = await uploadResponse.json().catch(() => null);
  return typeof uploadData?.bannerUrl === 'string' ? uploadData.bannerUrl : null;
}

app.post('/api/generate-banner', async (req, res) => {
  const parsed = BannerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  const authToken = (res.locals.authToken as string | undefined) ?? '';
  if (!userId || !authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const creditCheck = consumeCredit(userId);
  if (!creditCheck.ok) {
    if (creditCheck.reason === 'global') {
      return res.status(429).json({
        error: 'We’re at capacity right now. Please try again in a few minutes.',
        retryAfterSeconds: creditCheck.retryAfterSeconds,
      });
    }
    return res.status(429).json({
      error: 'Daily AI credits used. Please try again tomorrow.',
      remaining: creditCheck.remaining,
      limit: creditCheck.limit,
      resetAt: creditCheck.resetAt,
    });
  }

  try {
    const client = createLLMClient();
    const result = await client.generateBanner(parsed.data);

    if (parsed.data.dryRun) {
      return res.json({
        contentType: result.mimeType,
        imageBase64: result.buffer.toString('base64'),
      });
    }

    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/upload-banner`;
    const imageBase64 = result.buffer.toString('base64');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        contentType: result.mimeType,
        imageBase64,
      }),
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      return res.status(uploadResponse.status).json({
        error: errorData.error || 'Banner upload failed',
      });
    }

    const uploadData = await uploadResponse.json();
    if (!uploadData?.bannerUrl) {
      return res.status(500).json({ error: 'Banner URL missing from upload' });
    }

    return res.json({
      bannerUrl: uploadData.bannerUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});


app.listen(port, () => {
  console.log(`[agentic-backend] listening on :${port}`);
});
