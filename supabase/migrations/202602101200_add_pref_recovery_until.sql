-- Add pref_recovery_until column to waitlist_signups (idempotent)
DO $$
BEGIN
  IF to_regclass('public.waitlist_signups') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'waitlist_signups'
        AND column_name = 'pref_recovery_until'
    ) THEN
      ALTER TABLE public.waitlist_signups
        ADD COLUMN pref_recovery_until timestamptz;
    END IF;
  END IF;
END $$;
