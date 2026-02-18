export type AutoBannerMode = 'off' | 'async' | 'sync';

export type BannerEffectiveSource = 'generated' | 'channel_default' | 'none';

export type BannerPolicyRow = {
  id: string;
  created_at: string | null;
};

export type JobFailureTransition = {
  status: 'failed' | 'dead';
  availableAt: string | null;
};

export function normalizeAutoBannerMode(raw: unknown): AutoBannerMode {
  const normalized = String(raw || 'off').trim().toLowerCase();
  if (normalized === 'async') return 'async';
  if (normalized === 'sync') return 'sync';
  return 'off';
}

export function clampInt(raw: unknown, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const whole = Math.floor(n);
  return Math.min(max, Math.max(min, whole));
}

export function toStableIndex(key: string, count: number) {
  if (count <= 0) return -1;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

export function selectDeterministicDefaultBanner(input: {
  channelSlug: string;
  blueprintId: string;
  bannerUrls: string[];
}) {
  const urls = input.bannerUrls.filter(Boolean);
  if (!urls.length) return null;
  const key = `${input.channelSlug}:${input.blueprintId}`;
  const idx = toStableIndex(key, urls.length);
  return idx >= 0 ? urls[idx] : null;
}

export function partitionByBannerCap(rows: BannerPolicyRow[], cap: number) {
  const sorted = [...rows].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0;
    const bTs = b.created_at ? Date.parse(b.created_at) : 0;
    if (aTs !== bTs) return bTs - aTs;
    return b.id.localeCompare(a.id);
  });

  const safeCap = Math.max(0, cap);
  return {
    keep: sorted.slice(0, safeCap),
    demote: sorted.slice(safeCap),
  };
}

export function getFailureTransition(input: {
  attempts: number;
  maxAttempts: number;
  now: Date;
}) {
  const attempts = Math.max(0, input.attempts);
  const maxAttempts = Math.max(1, input.maxAttempts);
  if (attempts >= maxAttempts) {
    return {
      status: 'dead',
      availableAt: null,
    } as JobFailureTransition;
  }

  const backoffMinutes = Math.min(30, Math.max(1, 2 ** Math.max(0, attempts - 1)));
  return {
    status: 'failed',
    availableAt: new Date(input.now.getTime() + backoffMinutes * 60_000).toISOString(),
  } as JobFailureTransition;
}
