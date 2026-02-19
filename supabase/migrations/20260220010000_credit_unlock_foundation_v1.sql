-- bleuV1 shared unlock + regen credits foundation (step batch 1)

CREATE TABLE IF NOT EXISTS public.user_credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,3) NOT NULL DEFAULT 10.000,
  capacity numeric(12,3) NOT NULL DEFAULT 10.000,
  refill_rate_per_sec numeric(12,6) NOT NULL DEFAULT 0.002778,
  last_refill_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (balance >= 0),
  CHECK (capacity > 0),
  CHECK (refill_rate_per_sec >= 0)
);

CREATE TABLE IF NOT EXISTS public.source_item_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id uuid NOT NULL UNIQUE REFERENCES public.source_items(id) ON DELETE CASCADE,
  source_page_id uuid REFERENCES public.source_pages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  estimated_cost numeric(12,3) NOT NULL DEFAULT 1.000,
  reserved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reservation_expires_at timestamp with time zone,
  reserved_ledger_id uuid,
  blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL,
  last_error_code text,
  last_error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (status IN ('available', 'reserved', 'processing', 'ready')),
  CHECK (estimated_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta numeric(12,3) NOT NULL,
  entry_type text NOT NULL,
  reason_code text NOT NULL,
  source_item_id uuid REFERENCES public.source_items(id) ON DELETE SET NULL,
  source_page_id uuid REFERENCES public.source_pages(id) ON DELETE SET NULL,
  unlock_id uuid REFERENCES public.source_item_unlocks(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (entry_type IN ('grant', 'hold', 'settle', 'refund', 'adjust')),
  CHECK (entry_type = 'settle' OR delta <> 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'source_item_unlocks_reserved_ledger_id_fkey'
  ) THEN
    ALTER TABLE public.source_item_unlocks
      ADD CONSTRAINT source_item_unlocks_reserved_ledger_id_fkey
      FOREIGN KEY (reserved_ledger_id) REFERENCES public.credit_ledger(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_idempotency
  ON public.credit_ledger(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_item_unlocks_source_page_status
  ON public.source_item_unlocks(source_page_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_item_unlocks_reservation_expires
  ON public.source_item_unlocks(reservation_expires_at);

ALTER TABLE public.user_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_item_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit wallet" ON public.user_credit_wallets;
CREATE POLICY "Users can view own credit wallet"
  ON public.user_credit_wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can view own credit ledger"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view source item unlocks" ON public.source_item_unlocks;
CREATE POLICY "Anyone can view source item unlocks"
  ON public.source_item_unlocks FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_user_credit_wallets_updated_at ON public.user_credit_wallets;
CREATE TRIGGER update_user_credit_wallets_updated_at
  BEFORE UPDATE ON public.user_credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_source_item_unlocks_updated_at ON public.source_item_unlocks;
CREATE TRIGGER update_source_item_unlocks_updated_at
  BEFORE UPDATE ON public.source_item_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
