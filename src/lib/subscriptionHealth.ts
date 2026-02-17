type HealthVariant = 'secondary' | 'outline' | 'destructive';

export type SubscriptionHealthState = 'healthy' | 'delayed' | 'error' | 'never_polled';

export type SubscriptionHealth = {
  state: SubscriptionHealthState;
  label: string;
  badgeVariant: HealthVariant;
  detail: string;
  minutesSincePoll: number | null;
};

export type SubscriptionHealthSource = {
  last_polled_at: string | null;
  last_sync_error: string | null;
};

export type SubscriptionHealthSummary = {
  total: number;
  healthy: number;
  delayed: number;
  error: number;
  neverPolled: number;
  delayedRatio: number;
  lastSuccessfulPollAt: string | null;
};

export const SUBSCRIPTION_HEALTHY_WINDOW_MINUTES = 60;

function parseDateMs(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (!rem) return `${hours}h`;
  return `${hours}h ${rem}m`;
}

export function evaluateSubscriptionHealth(
  source: SubscriptionHealthSource,
  nowMs: number = Date.now(),
  healthyWindowMinutes: number = SUBSCRIPTION_HEALTHY_WINDOW_MINUTES,
): SubscriptionHealth {
  const syncError = (source.last_sync_error || '').trim();
  if (syncError) {
    return {
      state: 'error',
      label: 'Error',
      badgeVariant: 'destructive',
      detail: 'A sync error was recorded. Check details below.',
      minutesSincePoll: null,
    };
  }

  const polledAtMs = parseDateMs(source.last_polled_at);
  if (!polledAtMs) {
    return {
      state: 'never_polled',
      label: 'Waiting',
      badgeVariant: 'outline',
      detail: 'Waiting for first poll cycle.',
      minutesSincePoll: null,
    };
  }

  const minutesSincePoll = Math.max(0, Math.floor((nowMs - polledAtMs) / 60_000));
  if (minutesSincePoll <= healthyWindowMinutes) {
    return {
      state: 'healthy',
      label: 'Healthy',
      badgeVariant: 'secondary',
      detail: `Last polled ${formatAge(minutesSincePoll)} ago.`,
      minutesSincePoll,
    };
  }

  return {
    state: 'delayed',
    label: 'Delayed',
    badgeVariant: 'outline',
    detail: `No poll in ${formatAge(minutesSincePoll)}.`,
    minutesSincePoll,
  };
}

export function summarizeSubscriptionHealth(
  sources: SubscriptionHealthSource[],
  nowMs: number = Date.now(),
  healthyWindowMinutes: number = SUBSCRIPTION_HEALTHY_WINDOW_MINUTES,
): SubscriptionHealthSummary {
  const summary: SubscriptionHealthSummary = {
    total: sources.length,
    healthy: 0,
    delayed: 0,
    error: 0,
    neverPolled: 0,
    delayedRatio: 0,
    lastSuccessfulPollAt: null,
  };

  let latestSuccessfulPollMs: number | null = null;
  for (const source of sources) {
    const health = evaluateSubscriptionHealth(source, nowMs, healthyWindowMinutes);
    if (health.state === 'healthy') summary.healthy += 1;
    else if (health.state === 'delayed') summary.delayed += 1;
    else if (health.state === 'error') summary.error += 1;
    else summary.neverPolled += 1;

    if (!source.last_sync_error) {
      const pollMs = parseDateMs(source.last_polled_at);
      if (pollMs !== null && (latestSuccessfulPollMs === null || pollMs > latestSuccessfulPollMs)) {
        latestSuccessfulPollMs = pollMs;
      }
    }
  }

  summary.delayedRatio = summary.total > 0 ? summary.delayed / summary.total : 0;
  if (latestSuccessfulPollMs !== null) {
    summary.lastSuccessfulPollAt = new Date(latestSuccessfulPollMs).toISOString();
  }
  return summary;
}

