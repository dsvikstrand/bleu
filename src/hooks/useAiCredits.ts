import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/runtime';

type CreditsResponse = {
  remaining: number;
  limit: number;
  resetAt: string;
  bypass?: boolean;
  balance?: number;
  capacity?: number;
  refill_rate_per_sec?: number;
  seconds_to_full?: number;
};

function toFallbackCreditsFromWallet(wallet: {
  balance: number;
  capacity: number;
  refill_rate_per_sec: number;
  last_refill_at: string;
}): CreditsResponse {
  const nowMs = Date.now();
  const lastMs = Number.isFinite(Date.parse(wallet.last_refill_at)) ? Date.parse(wallet.last_refill_at) : nowMs;
  const elapsedSeconds = Math.max(0, (nowMs - lastMs) / 1000);
  const refilledBalance = Math.min(
    wallet.capacity,
    Math.max(0, wallet.balance + elapsedSeconds * Math.max(0, wallet.refill_rate_per_sec)),
  );
  const remainingToFull = Math.max(0, wallet.capacity - refilledBalance);
  const secondsToFull = wallet.refill_rate_per_sec > 0
    ? Math.ceil(remainingToFull / wallet.refill_rate_per_sec)
    : 0;

  return {
    remaining: refilledBalance,
    limit: wallet.capacity,
    resetAt: new Date(nowMs + Math.max(0, secondsToFull) * 1000).toISOString(),
    bypass: false,
    balance: refilledBalance,
    capacity: wallet.capacity,
    refill_rate_per_sec: wallet.refill_rate_per_sec,
    seconds_to_full: Math.max(0, secondsToFull),
  };
}

async function fetchCreditsFromWalletFallback(): Promise<CreditsResponse> {
  const { data: wallet, error } = await supabase
    .from('user_credit_wallets')
    .select('balance, capacity, refill_rate_per_sec, last_refill_at')
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load credits');
  }

  if (!wallet) {
    throw new Error('Unable to load credits');
  }

  return toFallbackCreditsFromWallet({
    balance: Number(wallet.balance || 0),
    capacity: Number(wallet.capacity || 0),
    refill_rate_per_sec: Number(wallet.refill_rate_per_sec || 0),
    last_refill_at: String(wallet.last_refill_at || new Date().toISOString()),
  });
}

async function fetchCredits(): Promise<CreditsResponse> {
  if (!config.agenticBackendUrl) {
    return fetchCreditsFromWalletFallback();
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${config.agenticBackendUrl!.replace(/\/$/, '')}/api/credits`;
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Unable to load credits');
    }

    return response.json();
  } catch {
    return fetchCreditsFromWalletFallback();
  }
}

export function useAiCredits(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-credits'],
    queryFn: fetchCredits,
    enabled: enabled && !!config.agenticBackendUrl,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}
