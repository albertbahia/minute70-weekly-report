-- Add user_id to report_events, rename payload → event_props,
-- add indexes, and add unique guard for trial_started per user.

-- 1. Add user_id column (nullable — existing anonymous rows stay NULL)
DO $$
BEGIN
  IF to_regclass('public.report_events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'report_events'
        AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.report_events
        ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2. Rename payload → event_props (if payload still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_events'
      AND column_name = 'payload'
  ) THEN
    ALTER TABLE public.report_events RENAME COLUMN payload TO event_props;
  END IF;
END $$;

-- 3. Set default on event_props
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_events'
      AND column_name = 'event_props'
  ) THEN
    ALTER TABLE public.report_events
      ALTER COLUMN event_props SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 4. Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_report_events_user_id
  ON public.report_events (user_id);

CREATE INDEX IF NOT EXISTS idx_report_events_event_type
  ON public.report_events (event_type);

CREATE INDEX IF NOT EXISTS idx_report_events_created_at
  ON public.report_events (created_at);

-- 5. Unique partial index: one trial_started per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trial_started_per_user
  ON public.report_events (user_id)
  WHERE event_type = 'trial_started';
