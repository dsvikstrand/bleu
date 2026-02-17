import { apiFetch } from '@/lib/api';

type LogEventPayload = {
  eventName: string;
  userId?: string | null;
  blueprintId?: string | null;
  path?: string;
  metadata?: Record<string, unknown>;
};

const TRACE_KEYS = [
  'run_id',
  'source_item_id',
  'user_feed_item_id',
  'candidate_id',
  'channel_slug',
  'reason_code',
] as const;

function withTraceDefaults(metadata?: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...(metadata || {}) };
  TRACE_KEYS.forEach((key) => {
    if (!(key in normalized)) {
      normalized[key] = null;
    }
  });
  return normalized;
}

export async function logMvpEvent({
  eventName,
  userId,
  blueprintId,
  path,
  metadata,
}: LogEventPayload) {
  if (!eventName) return;

  try {
    await apiFetch('log-event', {
      body: {
        event_name: eventName,
      user_id: userId ?? null,
      blueprint_id: blueprintId ?? null,
      path: path ?? window.location.pathname,
      metadata: withTraceDefaults(metadata),
    },
      keepalive: true,
      pinnedToEdge: true,
    });
  } catch {
    // Fire-and-forget: logging should never block UX.
  }
}
