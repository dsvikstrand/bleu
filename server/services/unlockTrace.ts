import { randomUUID } from 'node:crypto';

export type UnlockTraceContext = {
  trace_id: string;
  user_id?: string;
  platform?: string;
  external_id?: string;
  source_page_id?: string | null;
  source_item_id?: string | null;
  unlock_id?: string | null;
  job_id?: string | null;
  video_id?: string | null;
};

function cleanPayload(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    output[key] = value;
  }
  return output;
}

export function createUnlockTraceId() {
  return `ut_${randomUUID()}`;
}

export function buildUnlockTraceContext(
  base: UnlockTraceContext,
  extra?: Record<string, unknown>,
) {
  return cleanPayload({
    ...base,
    ...(extra || {}),
  });
}

export function logUnlockEvent(
  event: string,
  context: UnlockTraceContext,
  extra?: Record<string, unknown>,
) {
  const payload = buildUnlockTraceContext(context, extra);
  console.log(`[${event}]`, JSON.stringify(payload));
}

