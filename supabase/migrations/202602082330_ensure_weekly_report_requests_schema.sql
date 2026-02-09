-- Ensure weekly_report_requests has all required columns, indexes, and trigger.
-- Idempotent: safe to run whether columns/objects already exist or not.

DO $$ BEGIN
  IF to_regclass('public.weekly_report_requests') IS NOT NULL THEN

    -- Ensure tier column exists
    ALTER TABLE public.weekly_report_requests
      ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

    -- Ensure half_length_minutes column exists
    ALTER TABLE public.weekly_report_requests
      ADD COLUMN IF NOT EXISTS half_length_minutes integer NOT NULL DEFAULT 25;

    -- Add check constraint on tier (only if not already present)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.weekly_report_requests'::regclass
        AND conname = 'chk_tier_values'
    ) THEN
      ALTER TABLE public.weekly_report_requests
        ADD CONSTRAINT chk_tier_values CHECK (tier IN ('free', 'paid'));
    END IF;

    -- Ensure indexes exist
    CREATE INDEX IF NOT EXISTS idx_wrr_email_created
      ON public.weekly_report_requests (email, created_at DESC);

  ELSE
    RAISE NOTICE 'weekly_report_requests does not exist — skipping column ensures';
  END IF;
END $$;

-- Rate-limit trigger function: free = 1/week, paid = 3/week
CREATE OR REPLACE FUNCTION public.enforce_weekly_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  max_allowed int;
  recent_count int;
begin
  if new.tier = 'paid' then
    max_allowed := 3;
  else
    max_allowed := 1;
  end if;

  select count(*)
    into recent_count
  from public.weekly_report_requests
  where email = new.email
    and created_at >= (now() - interval '7 days');

  if recent_count >= max_allowed then
    raise exception
      using message = format(
        'rate_limited: %s already has %s report(s) in the last 7 days (max %s)',
        new.email, recent_count, max_allowed
      ),
      errcode = 'P0001';
  end if;

  return new;
end $function$;

-- Attach trigger (defensive)
DO $$ BEGIN
  IF to_regclass('public.weekly_report_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_weekly_report_rate_limit ON public.weekly_report_requests;

    CREATE TRIGGER trg_enforce_weekly_report_rate_limit
      BEFORE INSERT ON public.weekly_report_requests
      FOR EACH ROW EXECUTE FUNCTION public.enforce_weekly_report_rate_limit();
  ELSE
    RAISE NOTICE 'weekly_report_requests does not exist — skipping trigger';
  END IF;
END $$;
