-- bleuV1 async auto-banners with global cap + deterministic channel defaults

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS banner_generated_url text,
  ADD COLUMN IF NOT EXISTS banner_effective_source text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS banner_is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_policy_updated_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blueprints_banner_effective_source_check'
  ) THEN
    ALTER TABLE public.blueprints
      ADD CONSTRAINT blueprints_banner_effective_source_check
      CHECK (banner_effective_source IN ('generated', 'channel_default', 'none'));
  END IF;
END
$$;

UPDATE public.blueprints
SET banner_generated_url = banner_url,
    banner_effective_source = 'generated',
    banner_policy_updated_at = now()
WHERE banner_url IS NOT NULL
  AND banner_generated_url IS NULL;

CREATE TABLE IF NOT EXISTS public.channel_default_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_slug text NOT NULL,
  banner_url text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (channel_slug, banner_url)
);

CREATE TABLE IF NOT EXISTS public.auto_banner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES public.blueprints(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamp with time zone NOT NULL DEFAULT now(),
  last_error text,
  source_item_id uuid REFERENCES public.source_items(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.user_source_subscriptions(id) ON DELETE SET NULL,
  run_id text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auto_banner_jobs_status_check'
  ) THEN
    ALTER TABLE public.auto_banner_jobs
      ADD CONSTRAINT auto_banner_jobs_status_check
      CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_blueprints_banner_generated_created_at
  ON public.blueprints(created_at DESC)
  WHERE banner_generated_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auto_banner_jobs_claim
  ON public.auto_banner_jobs(status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_channel_default_banners_lookup
  ON public.channel_default_banners(channel_slug, is_active, priority, created_at);

ALTER TABLE public.channel_default_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_banner_jobs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_channel_default_banners_updated_at ON public.channel_default_banners;
CREATE TRIGGER update_channel_default_banners_updated_at
  BEFORE UPDATE ON public.channel_default_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_banner_jobs_updated_at ON public.auto_banner_jobs;
CREATE TRIGGER update_auto_banner_jobs_updated_at
  BEFORE UPDATE ON public.auto_banner_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
