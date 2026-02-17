-- bleuV1 subscriptions + auto-ingestion foundation (manual pending + auto publish)

ALTER TABLE public.user_feed_items
  ALTER COLUMN blueprint_id DROP NOT NULL;

ALTER TABLE public.source_items
  ADD COLUMN IF NOT EXISTS source_channel_id text,
  ADD COLUMN IF NOT EXISTS source_channel_title text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.user_source_subscriptions
  ADD COLUMN IF NOT EXISTS source_channel_url text,
  ADD COLUMN IF NOT EXISTS source_channel_title text,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_seen_published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_seen_video_id text,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.user_source_subscriptions(id) ON DELETE SET NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  processed_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ingestion jobs" ON public.ingestion_jobs;
DROP POLICY IF EXISTS "Users can insert own ingestion jobs" ON public.ingestion_jobs;
DROP POLICY IF EXISTS "Users can update own ingestion jobs" ON public.ingestion_jobs;

CREATE POLICY "Users can view own ingestion jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (requested_by_user_id = auth.uid());

CREATE POLICY "Users can insert own ingestion jobs"
  ON public.ingestion_jobs FOR INSERT
  WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "Users can update own ingestion jobs"
  ON public.ingestion_jobs FOR UPDATE
  USING (requested_by_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_source_items_channel
  ON public.source_items(source_type, source_channel_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_source_subscriptions_poll
  ON public.user_source_subscriptions(is_active, source_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_created
  ON public.ingestion_jobs(status, created_at DESC);

DROP TRIGGER IF EXISTS update_ingestion_jobs_updated_at ON public.ingestion_jobs;
CREATE TRIGGER update_ingestion_jobs_updated_at
  BEFORE UPDATE ON public.ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
