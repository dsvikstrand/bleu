-- Make newly created profiles public by default (existing rows unchanged).
ALTER TABLE public.profiles
ALTER COLUMN is_public SET DEFAULT true;
