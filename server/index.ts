import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createLLMClient } from './llm/client';
import { consumeCredit, getCredits } from './credits';
import type {
  BlueprintAnalysisRequest,
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

  if (!supabaseClient) {
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
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
