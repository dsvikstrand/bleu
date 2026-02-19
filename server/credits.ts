import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { consumeFlatCredit, getWallet, getWalletDefaults, type CreditLedgerContext } from './services/creditWallet';

type UsageState = {
  global: {
    timestamps: number[];
  };
};

const GLOBAL_WINDOW_MS = Number(process.env.AI_GLOBAL_WINDOW_MS) || 10 * 60 * 1000;
const GLOBAL_MAX = Number(process.env.AI_GLOBAL_MAX) || 25;

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let serviceClient: SupabaseClient<any, 'public', any> | null = null;

const state: UsageState = {
  global: {
    timestamps: [],
  },
};

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  }
  return serviceClient;
}

function pruneGlobal(nowMs: number) {
  state.global.timestamps = state.global.timestamps.filter((ts) => nowMs - ts <= GLOBAL_WINDOW_MS);
}

function nextResetAtFromWallet(secondsToFull: number) {
  const seconds = Math.max(0, Number(secondsToFull || 0));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function fallbackResetAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function getFallbackCredits() {
  const defaults = getWalletDefaults();
  return {
    remaining: defaults.capacity,
    limit: defaults.capacity,
    resetAt: fallbackResetAt(),
    bypass: true,
    balance: defaults.capacity,
    capacity: defaults.capacity,
    refill_rate_per_sec: defaults.refill_rate_per_sec,
    seconds_to_full: 0,
  };
}

export async function getCredits(userId: string) {
  const db = getServiceClient();
  if (!db) return getFallbackCredits();

  try {
    const wallet = await getWallet(db, userId);
    return {
      remaining: wallet.balance,
      limit: wallet.capacity,
      resetAt: nextResetAtFromWallet(wallet.seconds_to_full),
      bypass: wallet.bypass,
      balance: wallet.balance,
      capacity: wallet.capacity,
      refill_rate_per_sec: wallet.refill_rate_per_sec,
      seconds_to_full: wallet.seconds_to_full,
    };
  } catch {
    return getFallbackCredits();
  }
}

export async function consumeCredit(
  userId: string,
  input?: {
    amount?: number;
    reasonCode?: string;
    idempotencyKey?: string;
    context?: CreditLedgerContext;
  },
) {
  const db = getServiceClient();
  if (!db) {
    return {
      ok: true as const,
      ...(await getCredits(userId)),
    };
  }

  const nowMs = Date.now();
  pruneGlobal(nowMs);
  if (state.global.timestamps.length >= GLOBAL_MAX) {
    const oldest = state.global.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + GLOBAL_WINDOW_MS - nowMs) / 1000));
    return {
      ok: false as const,
      reason: 'global' as const,
      retryAfterSeconds,
    };
  }

  const amount = Math.max(0.001, Number(input?.amount ?? 1));
  const reasonCode = String(input?.reasonCode || 'AI_FLAT').trim() || 'AI_FLAT';
  const idempotencyKey = String(input?.idempotencyKey || `${reasonCode}:${userId}:${randomUUID()}`).trim();

  const consumed = await consumeFlatCredit(db, {
    userId,
    amount,
    reasonCode,
    idempotencyKey,
    context: input?.context,
  });

  if (!consumed.ok) {
    return {
      ok: false as const,
      reason: 'user' as const,
      remaining: consumed.wallet.balance,
      limit: consumed.wallet.capacity,
      resetAt: nextResetAtFromWallet(consumed.wallet.seconds_to_full),
      balance: consumed.wallet.balance,
      capacity: consumed.wallet.capacity,
      refill_rate_per_sec: consumed.wallet.refill_rate_per_sec,
      seconds_to_full: consumed.wallet.seconds_to_full,
    };
  }

  state.global.timestamps.push(nowMs);

  const wallet = consumed.wallet;
  return {
    ok: true as const,
    remaining: wallet.balance,
    limit: wallet.capacity,
    resetAt: nextResetAtFromWallet(wallet.seconds_to_full),
    bypass: wallet.bypass,
    balance: wallet.balance,
    capacity: wallet.capacity,
    refill_rate_per_sec: wallet.refill_rate_per_sec,
    seconds_to_full: wallet.seconds_to_full,
  };
}
