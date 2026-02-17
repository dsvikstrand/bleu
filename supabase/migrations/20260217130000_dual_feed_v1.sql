-- bleuV1 dual-feed foundation: source intake + personal feed + channel candidates

CREATE TABLE IF NOT EXISTS public.source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_native_id text NOT NULL,
  canonical_key text NOT NULL UNIQUE,
  source_url text NOT NULL,
  title text NOT NULL,
  published_at timestamp with time zone,
  ingest_status text NOT NULL DEFAULT 'ready',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_source_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_channel_id text NOT NULL,
  mode text NOT NULL DEFAULT 'selected',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_channel_id)
);

CREATE TABLE IF NOT EXISTS public.user_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_item_id uuid NOT NULL REFERENCES public.source_items(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'my_feed_published',
  remix_version_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  last_decision_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_item_id)
);

CREATE TABLE IF NOT EXISTS public.channel_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_feed_item_id uuid NOT NULL REFERENCES public.user_feed_items(id) ON DELETE CASCADE,
  channel_slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_feed_item_id, channel_slug)
);

CREATE TABLE IF NOT EXISTS public.channel_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.channel_candidates(id) ON DELETE CASCADE,
  gate_id text NOT NULL,
  outcome text NOT NULL,
  reason_code text NOT NULL,
  score numeric,
  policy_version text NOT NULL DEFAULT 'bleuv1-gate-policy-v1.0',
  method_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_items_source_type_native
  ON public.source_items(source_type, source_native_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_items_user_created
  ON public.user_feed_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_candidates_status
  ON public.channel_candidates(status);
CREATE INDEX IF NOT EXISTS idx_channel_gate_decisions_candidate
  ON public.channel_gate_decisions(candidate_id, created_at DESC);

ALTER TABLE public.source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_source_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_gate_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view source items" ON public.source_items;
DROP POLICY IF EXISTS "Authenticated can create source items" ON public.source_items;
DROP POLICY IF EXISTS "Authenticated can update source items" ON public.source_items;
DROP POLICY IF EXISTS "Users can view own source subscriptions" ON public.user_source_subscriptions;
DROP POLICY IF EXISTS "Users can create own source subscriptions" ON public.user_source_subscriptions;
DROP POLICY IF EXISTS "Users can update own source subscriptions" ON public.user_source_subscriptions;
DROP POLICY IF EXISTS "Users can delete own source subscriptions" ON public.user_source_subscriptions;
DROP POLICY IF EXISTS "Users can view own feed items" ON public.user_feed_items;
DROP POLICY IF EXISTS "Users can create own feed items" ON public.user_feed_items;
DROP POLICY IF EXISTS "Users can update own feed items" ON public.user_feed_items;
DROP POLICY IF EXISTS "Users can delete own feed items" ON public.user_feed_items;
DROP POLICY IF EXISTS "Users can view own channel candidates" ON public.channel_candidates;
DROP POLICY IF EXISTS "Users can create own channel candidates" ON public.channel_candidates;
DROP POLICY IF EXISTS "Users can update own channel candidates" ON public.channel_candidates;
DROP POLICY IF EXISTS "Users can delete own channel candidates" ON public.channel_candidates;
DROP POLICY IF EXISTS "Users can view gate decisions for owned candidates" ON public.channel_gate_decisions;
DROP POLICY IF EXISTS "Users can create gate decisions for owned candidates" ON public.channel_gate_decisions;

CREATE POLICY "Anyone can view source items"
  ON public.source_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create source items"
  ON public.source_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update source items"
  ON public.source_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own source subscriptions"
  ON public.user_source_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own source subscriptions"
  ON public.user_source_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own source subscriptions"
  ON public.user_source_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own source subscriptions"
  ON public.user_source_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feed items"
  ON public.user_feed_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feed items"
  ON public.user_feed_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed items"
  ON public.user_feed_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed items"
  ON public.user_feed_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own channel candidates"
  ON public.channel_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_feed_items ufi
      WHERE ufi.id = user_feed_item_id
        AND ufi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own channel candidates"
  ON public.channel_candidates FOR INSERT
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_feed_items ufi
      WHERE ufi.id = user_feed_item_id
        AND ufi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own channel candidates"
  ON public.channel_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_feed_items ufi
      WHERE ufi.id = user_feed_item_id
        AND ufi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own channel candidates"
  ON public.channel_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_feed_items ufi
      WHERE ufi.id = user_feed_item_id
        AND ufi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view gate decisions for owned candidates"
  ON public.channel_gate_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.channel_candidates cc
      JOIN public.user_feed_items ufi ON ufi.id = cc.user_feed_item_id
      WHERE cc.id = candidate_id
        AND ufi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create gate decisions for owned candidates"
  ON public.channel_gate_decisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.channel_candidates cc
      JOIN public.user_feed_items ufi ON ufi.id = cc.user_feed_item_id
      WHERE cc.id = candidate_id
        AND ufi.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_source_items_updated_at ON public.source_items;
CREATE TRIGGER update_source_items_updated_at
  BEFORE UPDATE ON public.source_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_source_subscriptions_updated_at ON public.user_source_subscriptions;
CREATE TRIGGER update_user_source_subscriptions_updated_at
  BEFORE UPDATE ON public.user_source_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_feed_items_updated_at ON public.user_feed_items;
CREATE TRIGGER update_user_feed_items_updated_at
  BEFORE UPDATE ON public.user_feed_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_candidates_updated_at ON public.channel_candidates;
CREATE TRIGGER update_channel_candidates_updated_at
  BEFORE UPDATE ON public.channel_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
