-- bleuV1 backend hardening: ingestion lease/retry metadata + provider circuit state

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_run_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

UPDATE public.ingestion_jobs
SET
  next_run_at = COALESCE(next_run_at, created_at, now()),
  max_attempts = COALESCE(max_attempts, 3),
  attempts = COALESCE(attempts, 0)
WHERE
  next_run_at IS NULL
  OR max_attempts IS NULL
  OR attempts IS NULL;

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_next_run
  ON public.ingestion_jobs(status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scope_status_next_run
  ON public.ingestion_jobs(scope, status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_lease_expires
  ON public.ingestion_jobs(lease_expires_at);

CREATE TABLE IF NOT EXISTS public.provider_circuit_state (
  provider_key text PRIMARY KEY,
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  opened_at timestamp with time zone,
  cooldown_until timestamp with time zone,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_circuit_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider circuit service read" ON public.provider_circuit_state;
DROP POLICY IF EXISTS "Provider circuit service write" ON public.provider_circuit_state;

CREATE POLICY "Provider circuit service read"
  ON public.provider_circuit_state FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Provider circuit service write"
  ON public.provider_circuit_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_provider_circuit_state_updated_at ON public.provider_circuit_state;
CREATE TRIGGER update_provider_circuit_state_updated_at
  BEFORE UPDATE ON public.provider_circuit_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_ingestion_jobs(
  p_scopes text[] DEFAULT NULL,
  p_max integer DEFAULT 1,
  p_worker_id text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 90
)
RETURNS SETOF public.ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer := GREATEST(1, LEAST(COALESCE(p_max, 1), 200));
  v_lease interval := make_interval(secs => GREATEST(5, LEAST(COALESCE(p_lease_seconds, 90), 3600)));
  v_worker text := COALESCE(NULLIF(trim(p_worker_id), ''), 'worker');
BEGIN
  RETURN QUERY
  WITH locked AS (
    SELECT j.id
    FROM public.ingestion_jobs j
    WHERE j.status = 'queued'
      AND COALESCE(j.next_run_at, now()) <= now()
      AND (j.lease_expires_at IS NULL OR j.lease_expires_at < now())
      AND (
        p_scopes IS NULL
        OR cardinality(p_scopes) = 0
        OR j.scope = ANY (p_scopes)
      )
    ORDER BY COALESCE(j.next_run_at, j.created_at) ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_max
  ), updated AS (
    UPDATE public.ingestion_jobs j
    SET
      status = 'running',
      attempts = COALESCE(j.attempts, 0) + 1,
      started_at = COALESCE(j.started_at, now()),
      worker_id = v_worker,
      lease_expires_at = now() + v_lease,
      last_heartbeat_at = now(),
      updated_at = now()
    FROM locked
    WHERE j.id = locked.id
    RETURNING j.*
  )
  SELECT * FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ingestion_jobs(text[], integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ingestion_jobs(text[], integer, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.touch_ingestion_job_lease(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease interval := make_interval(secs => GREATEST(5, LEAST(COALESCE(p_lease_seconds, 90), 3600)));
  v_updated integer := 0;
BEGIN
  UPDATE public.ingestion_jobs
  SET
    lease_expires_at = now() + v_lease,
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE id = p_job_id
    AND status = 'running'
    AND worker_id = COALESCE(NULLIF(trim(p_worker_id), ''), worker_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_ingestion_job_lease(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_ingestion_job_lease(uuid, text, integer) TO service_role;
