-- bleuV1 profile score from successful source unlocks

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unlocked_blueprints_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_profile_unlock_score_from_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_type = 'settle'
     AND NEW.reason_code = 'UNLOCK_SETTLE'
     AND NEW.unlock_id IS NOT NULL THEN
    UPDATE public.profiles
    SET unlocked_blueprints_count = COALESCE(unlocked_blueprints_count, 0) + 1
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_ledger_unlock_score_trigger ON public.credit_ledger;
CREATE TRIGGER credit_ledger_unlock_score_trigger
AFTER INSERT ON public.credit_ledger
FOR EACH ROW EXECUTE FUNCTION public.update_profile_unlock_score_from_ledger();

WITH unlock_counts AS (
  SELECT
    user_id,
    COUNT(*)::integer AS unlock_count
  FROM public.credit_ledger
  WHERE entry_type = 'settle'
    AND reason_code = 'UNLOCK_SETTLE'
    AND unlock_id IS NOT NULL
  GROUP BY user_id
)
UPDATE public.profiles p
SET unlocked_blueprints_count = COALESCE(u.unlock_count, 0)
FROM unlock_counts u
WHERE p.user_id = u.user_id;

UPDATE public.profiles
SET unlocked_blueprints_count = 0
WHERE user_id NOT IN (
  SELECT user_id
  FROM public.credit_ledger
  WHERE entry_type = 'settle'
    AND reason_code = 'UNLOCK_SETTLE'
    AND unlock_id IS NOT NULL
);
