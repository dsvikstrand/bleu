-- bleuV1 refresh cooldown tracking for manual subscription generation failures

CREATE TABLE IF NOT EXISTS public.refresh_video_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.user_source_subscriptions(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_result text NOT NULL,
  error_code text,
  error_message text,
  cooldown_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, subscription_id, video_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refresh_video_attempts_last_result_check'
  ) THEN
    ALTER TABLE public.refresh_video_attempts
      ADD CONSTRAINT refresh_video_attempts_last_result_check
      CHECK (last_result IN ('succeeded', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_refresh_video_attempts_user_cooldown
  ON public.refresh_video_attempts(user_id, cooldown_until);

CREATE INDEX IF NOT EXISTS idx_refresh_video_attempts_subscription_video
  ON public.refresh_video_attempts(subscription_id, video_id);

ALTER TABLE public.refresh_video_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own refresh video attempts" ON public.refresh_video_attempts;
CREATE POLICY "Users can view own refresh video attempts"
  ON public.refresh_video_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own refresh video attempts" ON public.refresh_video_attempts;
CREATE POLICY "Users can manage own refresh video attempts"
  ON public.refresh_video_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_refresh_video_attempts_updated_at ON public.refresh_video_attempts;
CREATE TRIGGER update_refresh_video_attempts_updated_at
  BEFORE UPDATE ON public.refresh_video_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
