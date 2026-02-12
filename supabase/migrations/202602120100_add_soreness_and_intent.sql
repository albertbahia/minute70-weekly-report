-- Add soreness columns and requested_mode to weekly_report_requests
-- Create anonymous report_events table for internal learning

DO $$
BEGIN
  IF to_regclass('public.weekly_report_requests') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'weekly_report_requests'
        AND column_name = 'requested_mode'
    ) THEN
      ALTER TABLE public.weekly_report_requests
        ADD COLUMN requested_mode text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'weekly_report_requests'
        AND column_name = 'soreness_hamstrings'
    ) THEN
      ALTER TABLE public.weekly_report_requests
        ADD COLUMN soreness_hamstrings smallint,
        ADD COLUMN soreness_groin_adductors smallint,
        ADD COLUMN soreness_quads_calves smallint,
        ADD COLUMN soreness_other_label text,
        ADD COLUMN soreness_other_value smallint;
    END IF;
  END IF;
END $$;

-- Anonymous report events table (no email, no user_id)
CREATE TABLE IF NOT EXISTS public.report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  payload jsonb
);

ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;
