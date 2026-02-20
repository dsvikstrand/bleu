import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<any, 'public', any>;

type WalletRow = {
  user_id: string;
  balance: string | number;
  capacity: string | number;
  refill_rate_per_sec: string | number;
  last_refill_at: string;
};

type LedgerRow = {
  id: string;
  user_id: string;
  delta: string | number;
  entry_type: 'grant' | 'hold' | 'settle' | 'refund' | 'adjust';
  reason_code: string;
  source_item_id: string | null;
  source_page_id: string | null;
  unlock_id: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const DEFAULT_CAPACITY = clampNumber(process.env.CREDIT_WALLET_CAPACITY, 10, 1, 10_000);
const DEFAULT_REFILL_SECONDS_PER_CREDIT = clampNumber(process.env.CREDIT_REFILL_SECONDS_PER_CREDIT, 360, 1, 86_400);
const DEFAULT_REFILL_RATE_PER_SEC = round6(1 / DEFAULT_REFILL_SECONDS_PER_CREDIT);
const DEFAULT_INITIAL_BALANCE = round3(Math.min(
  DEFAULT_CAPACITY,
  clampNumber(process.env.CREDIT_WALLET_INITIAL_BALANCE, DEFAULT_CAPACITY, 0, DEFAULT_CAPACITY),
));
const CREDITS_BYPASS = /^(1|true|yes)$/i.test(process.env.AI_CREDITS_BYPASS ?? '');

function clampNumber(raw: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function getNowIso() {
  return new Date().toISOString();
}

function computeRefilledBalance(input: {
  balance: number;
  capacity: number;
  refillRatePerSec: number;
  lastRefillAt: string;
  nowIso: string;
}) {
  const lastMs = Date.parse(input.lastRefillAt);
  const nowMs = Date.parse(input.nowIso);
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs) || nowMs <= lastMs) {
    const clamped = round3(Math.min(input.capacity, Math.max(0, input.balance)));
    return {
      balance: clamped,
      changed: clamped !== round3(input.balance),
      elapsedSeconds: 0,
    };
  }

  const elapsedSeconds = Math.max(0, (nowMs - lastMs) / 1000);
  const refilled = round3(Math.min(input.capacity, input.balance + elapsedSeconds * input.refillRatePerSec));
  return {
    balance: refilled,
    changed: refilled !== round3(input.balance),
    elapsedSeconds,
  };
}

async function getLedgerByIdempotencyKey(db: DbClient, idempotencyKey: string) {
  const key = String(idempotencyKey || '').trim();
  if (!key) return null;
  const { data, error } = await db
    .from('credit_ledger')
    .select('id, user_id, delta, entry_type, reason_code, source_item_id, source_page_id, unlock_id, idempotency_key, metadata, created_at')
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as LedgerRow | null;
}

export type CreditWalletSnapshot = {
  user_id: string;
  balance: number;
  capacity: number;
  refill_rate_per_sec: number;
  last_refill_at: string;
  seconds_to_full: number;
  bypass: boolean;
};

export type CreditReserveSuccess = {
  ok: true;
  ledger_id: string | null;
  reserved_amount: number;
  wallet: CreditWalletSnapshot;
  bypass: boolean;
};

export type CreditReserveInsufficient = {
  ok: false;
  reason: 'insufficient';
  required: number;
  wallet: CreditWalletSnapshot;
};

export type CreditReserveResult = CreditReserveSuccess | CreditReserveInsufficient;

export type CreditLedgerContext = {
  source_item_id?: string | null;
  source_page_id?: string | null;
  unlock_id?: string | null;
  metadata?: Record<string, unknown>;
};

async function ensureWalletRow(db: DbClient, userId: string) {
  const nowIso = getNowIso();
  const { error } = await db
    .from('user_credit_wallets')
    .upsert({
      user_id: userId,
      balance: DEFAULT_INITIAL_BALANCE,
      capacity: DEFAULT_CAPACITY,
      refill_rate_per_sec: DEFAULT_REFILL_RATE_PER_SEC,
      last_refill_at: nowIso,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw error;
}

async function getWalletRow(db: DbClient, userId: string) {
  const { data, error } = await db
    .from('user_credit_wallets')
    .select('user_id, balance, capacity, refill_rate_per_sec, last_refill_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as WalletRow | null;
}

async function updateWalletRefill(db: DbClient, input: {
  userId: string;
  fromLastRefillAt: string;
  fromBalance: number;
  nextBalance: number;
  nowIso: string;
}) {
  const { data, error } = await db
    .from('user_credit_wallets')
    .update({
      balance: round3(input.nextBalance),
      last_refill_at: input.nowIso,
    })
    .eq('user_id', input.userId)
    .eq('last_refill_at', input.fromLastRefillAt)
    .eq('balance', round3(input.fromBalance))
    .select('user_id, balance, capacity, refill_rate_per_sec, last_refill_at')
    .maybeSingle();
  if (error) throw error;
  return (data || null) as WalletRow | null;
}

function toSnapshot(row: WalletRow): CreditWalletSnapshot {
  const balance = round3(asNumber(row.balance));
  const capacity = round3(asNumber(row.capacity, DEFAULT_CAPACITY));
  const refillRate = round6(asNumber(row.refill_rate_per_sec, DEFAULT_REFILL_RATE_PER_SEC));
  const remainingToFull = Math.max(0, capacity - balance);
  const secondsToFull = refillRate > 0 ? Math.ceil(remainingToFull / refillRate) : Number.MAX_SAFE_INTEGER;
  return {
    user_id: row.user_id,
    balance,
    capacity,
    refill_rate_per_sec: refillRate,
    last_refill_at: row.last_refill_at,
    seconds_to_full: Number.isFinite(secondsToFull) ? secondsToFull : 0,
    bypass: CREDITS_BYPASS,
  };
}

async function refreshWallet(db: DbClient, userId: string) {
  await ensureWalletRow(db, userId);
  let row = await getWalletRow(db, userId);
  if (!row) {
    throw new Error('WALLET_NOT_FOUND');
  }

  if (CREDITS_BYPASS) {
    return {
      row,
      snapshot: {
        ...toSnapshot({
          ...row,
          balance: row.capacity,
        }),
        bypass: true,
      } satisfies CreditWalletSnapshot,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nowIso = getNowIso();
    const currentBalance = round3(asNumber(row.balance));
    const capacity = round3(asNumber(row.capacity, DEFAULT_CAPACITY));
    const refillRatePerSec = round6(asNumber(row.refill_rate_per_sec, DEFAULT_REFILL_RATE_PER_SEC));
    const refill = computeRefilledBalance({
      balance: currentBalance,
      capacity,
      refillRatePerSec,
      lastRefillAt: row.last_refill_at,
      nowIso,
    });

    if (!refill.changed) {
      return {
        row,
        snapshot: toSnapshot({
          ...row,
          balance: refill.balance,
        }),
      };
    }

    const updated = await updateWalletRefill(db, {
      userId,
      fromLastRefillAt: row.last_refill_at,
      fromBalance: currentBalance,
      nextBalance: refill.balance,
      nowIso,
    });

    if (updated) {
      row = updated;
      return {
        row,
        snapshot: toSnapshot(updated),
      };
    }

    const latest = await getWalletRow(db, userId);
    if (latest) {
      row = latest;
      continue;
    }
  }

  row = (await getWalletRow(db, userId)) as WalletRow;
  return {
    row,
    snapshot: toSnapshot(row),
  };
}

async function insertLedgerEntry(db: DbClient, input: {
  userId: string;
  delta: number;
  entryType: LedgerRow['entry_type'];
  reasonCode: string;
  idempotencyKey: string;
  context?: CreditLedgerContext;
}) {
  const { data, error } = await db
    .from('credit_ledger')
    .insert({
      user_id: input.userId,
      delta: round3(input.delta),
      entry_type: input.entryType,
      reason_code: input.reasonCode,
      source_item_id: input.context?.source_item_id || null,
      source_page_id: input.context?.source_page_id || null,
      unlock_id: input.context?.unlock_id || null,
      idempotency_key: input.idempotencyKey,
      metadata: input.context?.metadata || {},
    })
    .select('id, user_id, delta, entry_type, reason_code, source_item_id, source_page_id, unlock_id, idempotency_key, metadata, created_at')
    .single();

  if (error) {
    const code = String((error as { code?: string }).code || '').trim();
    if (code === '23505') {
      const existing = await getLedgerByIdempotencyKey(db, input.idempotencyKey);
      if (existing) return existing;
    }
    throw error;
  }

  return data as LedgerRow;
}

export async function getWallet(db: DbClient, userId: string): Promise<CreditWalletSnapshot> {
  const { snapshot } = await refreshWallet(db, userId);
  return snapshot;
}

export async function reserveCredits(db: DbClient, input: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  reasonCode: string;
  context?: CreditLedgerContext;
}): Promise<CreditReserveResult> {
  const userId = String(input.userId || '').trim();
  const amount = round3(Math.max(0, Number(input.amount || 0)));
  if (!userId) throw new Error('AUTH_REQUIRED');
  if (!(amount > 0)) throw new Error('INVALID_RESERVE_AMOUNT');

  if (CREDITS_BYPASS) {
    const wallet = await getWallet(db, userId);
    return {
      ok: true,
      ledger_id: null,
      reserved_amount: amount,
      wallet,
      bypass: true,
    };
  }

  const existingLedger = await getLedgerByIdempotencyKey(db, input.idempotencyKey);
  if (existingLedger && existingLedger.entry_type === 'hold') {
    const wallet = await getWallet(db, userId);
    return {
      ok: true,
      ledger_id: existingLedger.id,
      reserved_amount: Math.abs(round3(asNumber(existingLedger.delta))),
      wallet,
      bypass: false,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const refreshed = await refreshWallet(db, userId);
    const currentRow = refreshed.row;
    const currentBalance = round3(asNumber(currentRow.balance));

    if (currentBalance < amount) {
      return {
        ok: false,
        reason: 'insufficient',
        required: amount,
        wallet: refreshed.snapshot,
      };
    }

    const nowIso = getNowIso();
    const nextBalance = round3(currentBalance - amount);
    const { data: updatedWallet, error: updateError } = await db
      .from('user_credit_wallets')
      .update({
        balance: nextBalance,
        last_refill_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('balance', currentBalance)
      .eq('last_refill_at', currentRow.last_refill_at)
      .select('user_id, balance, capacity, refill_rate_per_sec, last_refill_at')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedWallet) continue;

    try {
      const ledger = await insertLedgerEntry(db, {
        userId,
        delta: -amount,
        entryType: 'hold',
        reasonCode: input.reasonCode,
        idempotencyKey: input.idempotencyKey,
        context: input.context,
      });

      const wallet = toSnapshot(updatedWallet as WalletRow);
      return {
        ok: true,
        ledger_id: ledger.id,
        reserved_amount: amount,
        wallet,
        bypass: false,
      };
    } catch (error) {
      await db
        .from('user_credit_wallets')
        .update({
          balance: round3(nextBalance + amount),
          last_refill_at: nowIso,
        })
        .eq('user_id', userId)
        .eq('balance', nextBalance);
      throw error;
    }
  }

  const wallet = await getWallet(db, userId);
  if (wallet.balance < amount) {
    return {
      ok: false,
      reason: 'insufficient',
      required: amount,
      wallet,
    };
  }
  throw new Error('WALLET_RESERVE_CONFLICT');
}

export async function settleReservation(db: DbClient, input: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  reasonCode: string;
  context?: CreditLedgerContext;
}) {
  const amount = round3(Math.max(0, Number(input.amount || 0)));
  if (!(amount >= 0)) throw new Error('INVALID_SETTLE_AMOUNT');
  if (CREDITS_BYPASS) {
    return { bypass: true, ledger_id: null };
  }

  const ledger = await insertLedgerEntry(db, {
    userId: input.userId,
    delta: 0,
    entryType: 'settle',
    reasonCode: input.reasonCode,
    idempotencyKey: input.idempotencyKey,
    context: {
      ...(input.context || {}),
      metadata: {
        ...(input.context?.metadata || {}),
        settled_amount: amount,
      },
    },
  });

  return {
    bypass: false,
    ledger_id: ledger.id,
  };
}

export async function refundReservation(db: DbClient, input: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  reasonCode: string;
  context?: CreditLedgerContext;
}) {
  const amount = round3(Math.max(0, Number(input.amount || 0)));
  if (!(amount > 0)) throw new Error('INVALID_REFUND_AMOUNT');

  if (CREDITS_BYPASS) {
    return {
      bypass: true,
      ledger_id: null,
      wallet: await getWallet(db, input.userId),
    };
  }

  const existing = await getLedgerByIdempotencyKey(db, input.idempotencyKey);
  if (existing && existing.entry_type === 'refund') {
    return {
      bypass: false,
      ledger_id: existing.id,
      wallet: await getWallet(db, input.userId),
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const refreshed = await refreshWallet(db, input.userId);
    const row = refreshed.row;
    const balance = round3(asNumber(row.balance));
    const capacity = round3(asNumber(row.capacity));
    const nowIso = getNowIso();
    const nextBalance = round3(Math.min(capacity, balance + amount));

    const { data: updated, error: updateError } = await db
      .from('user_credit_wallets')
      .update({
        balance: nextBalance,
        last_refill_at: nowIso,
      })
      .eq('user_id', input.userId)
      .eq('balance', balance)
      .eq('last_refill_at', row.last_refill_at)
      .select('user_id, balance, capacity, refill_rate_per_sec, last_refill_at')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) continue;

    const ledger = await insertLedgerEntry(db, {
      userId: input.userId,
      delta: amount,
      entryType: 'refund',
      reasonCode: input.reasonCode,
      idempotencyKey: input.idempotencyKey,
      context: input.context,
    });

    return {
      bypass: false,
      ledger_id: ledger.id,
      wallet: toSnapshot(updated as WalletRow),
    };
  }

  throw new Error('WALLET_REFUND_CONFLICT');
}

export async function consumeFlatCredit(db: DbClient, input: {
  userId: string;
  amount?: number;
  reasonCode: string;
  idempotencyKey: string;
  context?: CreditLedgerContext;
}): Promise<CreditReserveResult> {
  const amount = round3(Math.max(0.001, Number(input.amount ?? 1)));
  const hold = await reserveCredits(db, {
    userId: input.userId,
    amount,
    idempotencyKey: `${input.idempotencyKey}:hold`,
    reasonCode: `${input.reasonCode}_HOLD`,
    context: input.context,
  });

  if (!hold.ok) return hold;

  await settleReservation(db, {
    userId: input.userId,
    amount,
    idempotencyKey: `${input.idempotencyKey}:settle`,
    reasonCode: `${input.reasonCode}_SETTLE`,
    context: input.context,
  });

  return hold;
}

export function getWalletDefaults() {
  return {
    capacity: DEFAULT_CAPACITY,
    refill_rate_per_sec: DEFAULT_REFILL_RATE_PER_SEC,
    initial_balance: DEFAULT_INITIAL_BALANCE,
    bypass: CREDITS_BYPASS,
  };
}
