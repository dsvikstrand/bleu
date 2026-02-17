-- bleuV1 MVP simplification: subscriptions are auto-only (new uploads only)

UPDATE public.user_source_subscriptions
SET mode = 'auto'
WHERE mode = 'manual';
