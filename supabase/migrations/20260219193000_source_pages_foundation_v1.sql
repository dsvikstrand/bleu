-- bleuV1 source pages foundation (platform-agnostic, youtube runtime)

CREATE TABLE IF NOT EXISTS public.source_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  external_id text NOT NULL,
  external_url text NOT NULL,
  title text NOT NULL,
  avatar_url text,
  banner_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

ALTER TABLE public.user_source_subscriptions
  ADD COLUMN IF NOT EXISTS source_page_id uuid REFERENCES public.source_pages(id) ON DELETE SET NULL;

ALTER TABLE public.source_items
  ADD COLUMN IF NOT EXISTS source_page_id uuid REFERENCES public.source_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_source_pages_platform_external_id
  ON public.source_pages(platform, external_id);

CREATE INDEX IF NOT EXISTS idx_user_source_subscriptions_source_page_id
  ON public.user_source_subscriptions(source_page_id);

CREATE INDEX IF NOT EXISTS idx_source_items_source_page_id
  ON public.source_items(source_page_id);

ALTER TABLE public.source_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view source pages" ON public.source_pages;
CREATE POLICY "Anyone can view source pages"
  ON public.source_pages FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_source_pages_updated_at ON public.source_pages;
CREATE TRIGGER update_source_pages_updated_at
  BEFORE UPDATE ON public.source_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.source_pages (
  platform,
  external_id,
  external_url,
  title,
  metadata
)
SELECT DISTINCT
  'youtube' AS platform,
  uss.source_channel_id AS external_id,
  COALESCE(NULLIF(uss.source_channel_url, ''), 'https://www.youtube.com/channel/' || uss.source_channel_id) AS external_url,
  COALESCE(NULLIF(uss.source_channel_title, ''), uss.source_channel_id) AS title,
  jsonb_build_object('seed', 'user_source_subscriptions_backfill') AS metadata
FROM public.user_source_subscriptions uss
WHERE uss.source_type = 'youtube'
  AND COALESCE(NULLIF(uss.source_channel_id, ''), '') <> ''
ON CONFLICT (platform, external_id) DO UPDATE
SET
  external_url = EXCLUDED.external_url,
  title = CASE
    WHEN COALESCE(NULLIF(public.source_pages.title, ''), '') = '' THEN EXCLUDED.title
    ELSE public.source_pages.title
  END,
  updated_at = now();

UPDATE public.user_source_subscriptions uss
SET source_page_id = sp.id
FROM public.source_pages sp
WHERE uss.source_page_id IS NULL
  AND uss.source_type = 'youtube'
  AND sp.platform = 'youtube'
  AND sp.external_id = uss.source_channel_id;

UPDATE public.source_items si
SET source_page_id = sp.id
FROM public.source_pages sp
WHERE si.source_page_id IS NULL
  AND si.source_type = 'youtube'
  AND COALESCE(NULLIF(si.source_channel_id, ''), '') <> ''
  AND sp.platform = 'youtube'
  AND sp.external_id = si.source_channel_id;
