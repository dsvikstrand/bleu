import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createLLMClient } from './llm/client';
import { consumeCredit, getCredits } from './credits';
import { getTranscriptForVideo } from './transcript/getTranscript';
import { TranscriptProviderError } from './transcript/types';
import type {
  BlueprintAnalysisRequest,
  BlueprintGenerationRequest,
  BlueprintGenerationResult,
  BlueprintSelectedItem,
  InventoryRequest,
} from './llm/types';

const app = express();
const port = Number(process.env.PORT) || 8787;

app.set('trust proxy', true);

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

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = [
      req.ip,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${durationMs.toFixed(1)}ms`,
    ].join(' ');
    console.log(line);
  });
  next();
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/api/health') return next();
  const allowsAnonymous = req.path === '/api/youtube-to-blueprint';

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

app.post('/api/youtube-to-blueprint', async (req, res) => {
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
  const validatedUrl = validateYouTubeUrl(parsed.data.video_url);
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
        videoId: validatedUrl.videoId,
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
      const status =
        known.error_code === 'TIMEOUT' ? 504
          : known.error_code === 'INVALID_URL' ? 400
            : known.error_code === 'NO_CAPTIONS' || known.error_code === 'TRANSCRIPT_EMPTY' ? 422
              : known.error_code === 'PII_BLOCKED' || known.error_code === 'SAFETY_BLOCKED' ? 422
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
  | 'INVALID_URL'
  | 'NO_CAPTIONS'
  | 'TRANSCRIPT_FETCH_FAIL'
  | 'TRANSCRIPT_EMPTY'
  | 'GENERATION_FAIL'
  | 'SAFETY_BLOCKED'
  | 'PII_BLOCKED'
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
    return { error_code: error.code, message: error.message };
  }
  return null;
}

function validateYouTubeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, '');
    if (url.searchParams.has('list')) {
      return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Playlist URLs are not supported.' };
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname !== '/watch') {
        return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Only single YouTube watch URLs are supported.' };
      }
      const videoId = url.searchParams.get('v')?.trim() || '';
      if (!/^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
        return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Invalid YouTube video URL.' };
      }
      return { ok: true as const, videoId };
    }

    if (host === 'youtu.be') {
      const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]?.trim() || '';
      if (!/^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
        return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Invalid YouTube short URL.' };
      }
      return { ok: true as const, videoId };
    }

    return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Only YouTube URLs are supported.' };
  } catch {
    return { ok: false as const, errorCode: 'INVALID_URL' as const, message: 'Invalid URL.' };
  }
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
  const rawDraft = await client.generateYouTubeBlueprint({
    videoUrl: input.videoUrl,
    transcript: transcript.text,
  });

  const draft = {
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
  };

  if (!draft.steps.length) {
    makePipelineError('GENERATION_FAIL', 'Generated blueprint had no usable steps.');
  }

  const flattened = flattenDraftText(draft);
  const safety = runSafetyChecks(flattened);
  if (!safety.ok) {
    makePipelineError('SAFETY_BLOCKED', `Forbidden topics detected: ${safety.blockedTopics.join(', ')}`);
  }
  const pii = runPiiChecks(flattened);
  if (!pii.ok) {
    makePipelineError('PII_BLOCKED', `PII detected: ${pii.matches.join(', ')}`);
  }
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
      includeScore: false,
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
