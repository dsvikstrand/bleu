import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<any, 'public', any>;

export type IngestionJobRow = {
  id: string;
  trigger: string;
  scope: string;
  status: string;
  requested_by_user_id: string | null;
  subscription_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  processed_count: number;
  inserted_count: number;
  skipped_count: number;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  worker_id: string | null;
  trace_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function clampInt(raw: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function claimQueuedIngestionJobs(db: DbClient, input: {
  scopes?: string[];
  maxJobs?: number;
  workerId: string;
  leaseSeconds: number;
}) {
  const scopes = Array.isArray(input.scopes) ? input.scopes.filter(Boolean) : [];
  const maxJobs = clampInt(input.maxJobs, 1, 1, 200);
  const leaseSeconds = clampInt(input.leaseSeconds, 90, 5, 3600);

  const { data, error } = await db.rpc('claim_ingestion_jobs', {
    p_scopes: scopes.length ? scopes : null,
    p_max: maxJobs,
    p_worker_id: input.workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;
  return (data || []) as IngestionJobRow[];
}

export async function touchIngestionJobLease(db: DbClient, input: {
  jobId: string;
  workerId: string;
  leaseSeconds: number;
}) {
  const leaseSeconds = clampInt(input.leaseSeconds, 90, 5, 3600);
  const { data, error } = await db.rpc('touch_ingestion_job_lease', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function countQueueDepth(db: DbClient, input?: {
  scope?: string;
  userId?: string;
  includeRunning?: boolean;
}) {
  const statuses = input?.includeRunning ? ['queued', 'running'] : ['queued'];
  let query = db
    .from('ingestion_jobs')
    .select('id', { head: true, count: 'exact' })
    .in('status', statuses);

  if (input?.scope) query = query.eq('scope', input.scope);
  if (input?.userId) query = query.eq('requested_by_user_id', input.userId);

  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

export async function failIngestionJob(db: DbClient, input: {
  jobId: string;
  errorCode: string;
  errorMessage: string;
  scheduleRetryInSeconds?: number;
  maxAttempts?: number;
}) {
  const now = new Date();
  const retryDelay = clampInt(input.scheduleRetryInSeconds, 0, 0, 24 * 3600);
  const nextRunAt = new Date(now.getTime() + retryDelay * 1000).toISOString();
  const maxAttempts = clampInt(input.maxAttempts, 3, 1, 20);

  const { data: current, error: readError } = await db
    .from('ingestion_jobs')
    .select('id, attempts')
    .eq('id', input.jobId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return null;

  const attempts = Number(current.attempts || 0);
  const shouldRetry = retryDelay > 0 && attempts < maxAttempts;
  const nextStatus = shouldRetry ? 'queued' : 'failed';

  const { data, error } = await db
    .from('ingestion_jobs')
    .update({
      status: nextStatus,
      finished_at: shouldRetry ? null : now.toISOString(),
      next_run_at: shouldRetry ? nextRunAt : now.toISOString(),
      lease_expires_at: null,
      worker_id: null,
      last_heartbeat_at: now.toISOString(),
      error_code: String(input.errorCode || '').slice(0, 120) || 'FAILED',
      error_message: String(input.errorMessage || '').slice(0, 500),
    })
    .eq('id', input.jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data as IngestionJobRow;
}
