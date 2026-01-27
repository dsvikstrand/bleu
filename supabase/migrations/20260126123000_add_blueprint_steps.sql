ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS steps jsonb;
