-- bleuV1 YouTube OAuth connection + import state tables

CREATE TABLE IF NOT EXISTS public.user_youtube_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_sub text,
  youtube_channel_id text,
  youtube_channel_title text,
  youtube_channel_url text,
  youtube_channel_avatar_url text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamp with time zone,
  scope text,
  is_active boolean NOT NULL DEFAULT true,
  last_import_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.youtube_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  return_to text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_youtube_connections_user
  ON public.user_youtube_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_oauth_states_user_expires
  ON public.youtube_oauth_states(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_youtube_oauth_states_hash
  ON public.youtube_oauth_states(state_hash);

ALTER TABLE public.user_youtube_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own youtube connection" ON public.user_youtube_connections;
CREATE POLICY "Users can view own youtube connection"
  ON public.user_youtube_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own youtube connection" ON public.user_youtube_connections;
CREATE POLICY "Users can insert own youtube connection"
  ON public.user_youtube_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own youtube connection" ON public.user_youtube_connections;
CREATE POLICY "Users can update own youtube connection"
  ON public.user_youtube_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own youtube connection" ON public.user_youtube_connections;
CREATE POLICY "Users can delete own youtube connection"
  ON public.user_youtube_connections FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own youtube oauth states" ON public.youtube_oauth_states;
CREATE POLICY "Users can view own youtube oauth states"
  ON public.youtube_oauth_states FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own youtube oauth states" ON public.youtube_oauth_states;
CREATE POLICY "Users can insert own youtube oauth states"
  ON public.youtube_oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own youtube oauth states" ON public.youtube_oauth_states;
CREATE POLICY "Users can update own youtube oauth states"
  ON public.youtube_oauth_states FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own youtube oauth states" ON public.youtube_oauth_states;
CREATE POLICY "Users can delete own youtube oauth states"
  ON public.youtube_oauth_states FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_youtube_connections_updated_at ON public.user_youtube_connections;
CREATE TRIGGER update_user_youtube_connections_updated_at
  BEFORE UPDATE ON public.user_youtube_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
