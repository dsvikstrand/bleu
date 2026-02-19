-- bleuV1 optional signup onboarding state for YouTube connect/import.

CREATE TABLE IF NOT EXISTS public.user_youtube_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'skipped', 'completed')),
  first_prompted_at timestamp with time zone,
  completed_at timestamp with time zone,
  reminder_dismissed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_youtube_onboarding_user
  ON public.user_youtube_onboarding(user_id);

ALTER TABLE public.user_youtube_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own youtube onboarding" ON public.user_youtube_onboarding;
CREATE POLICY "Users can view own youtube onboarding"
  ON public.user_youtube_onboarding FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own youtube onboarding" ON public.user_youtube_onboarding;
CREATE POLICY "Users can update own youtube onboarding"
  ON public.user_youtube_onboarding FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own youtube onboarding" ON public.user_youtube_onboarding;
CREATE POLICY "Users can delete own youtube onboarding"
  ON public.user_youtube_onboarding FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_youtube_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_youtube_onboarding (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_youtube_onboarding ON auth.users;
CREATE TRIGGER on_auth_user_created_youtube_onboarding
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_youtube_onboarding();

DROP TRIGGER IF EXISTS update_user_youtube_onboarding_updated_at ON public.user_youtube_onboarding;
CREATE TRIGGER update_user_youtube_onboarding_updated_at
  BEFORE UPDATE ON public.user_youtube_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
