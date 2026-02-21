-- Premium UX Loop: enums, tables, indexes for session player + entitlements
-- Handles DEV collision: plans table already exists with different schema

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'app_focus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_focus AS ENUM ('late_game', 'injury_prevention');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'entitlement_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.entitlement_status
      AS ENUM ('free', 'trial', 'pro_monthly', 'pro_season', 'promo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'promo_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.promo_status AS ENUM ('active', 'expired', 'exhausted');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'session_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.session_status AS ENUM ('scheduled', 'completed', 'skipped');
  END IF;
END $$;

-- ============================================================
-- 2. user_profiles (avoids collision with existing "profiles" table on DEV)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus      public.app_focus NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. entitlements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.entitlements (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                        public.entitlement_status NOT NULL DEFAULT 'free',
  start_at                      timestamptz NOT NULL DEFAULT now(),
  end_at                        timestamptz,
  source                        text,
  weekly_pro_sessions_remaining int NOT NULL DEFAULT 3,
  weekly_sessions_reset_at      timestamptz NOT NULL DEFAULT now(),
  redemption_attempts           int NOT NULL DEFAULT 0,
  created_at                    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_entitlements_user_id
  ON public.entitlements (user_id);

-- ============================================================
-- 4. promo_redemptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  code              text NOT NULL,
  first_redeemed_at timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  attempts          int NOT NULL DEFAULT 1,
  status            public.promo_status NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_redemptions_user_code
  ON public.promo_redemptions (user_id, code);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_id
  ON public.promo_redemptions (user_id);

-- ============================================================
-- 5. matches
-- ============================================================

CREATE TABLE IF NOT EXISTS public.matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_datetime timestamptz NOT NULL,
  league_name    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_matches_user_id
  ON public.matches (user_id);

CREATE INDEX IF NOT EXISTS idx_matches_user_datetime
  ON public.matches (user_id, match_datetime DESC);

-- ============================================================
-- 6. plans (DEV has old schema — add missing columns idempotently)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id         uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  focus            text,
  sessions_per_week int NOT NULL DEFAULT 2,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Idempotently add columns that may be missing on DEV (old plans table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'match_id'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'sessions_per_week'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN sessions_per_week int NOT NULL DEFAULT 2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'focus'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN focus text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plans_user_id
  ON public.plans (user_id);

CREATE INDEX IF NOT EXISTS idx_plans_match_id
  ON public.plans (match_id);

-- ============================================================
-- 7. sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  scheduled_for    date NOT NULL,
  completed_at     timestamptz,
  duration_minutes int NOT NULL DEFAULT 8,
  status           public.session_status NOT NULL DEFAULT 'scheduled',
  moves            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sessions_plan_id
  ON public.sessions (plan_id);

CREATE INDEX IF NOT EXISTS idx_sessions_plan_status
  ON public.sessions (plan_id, status);

-- ============================================================
-- 8. session_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_session_events_session_id
  ON public.session_events (session_id);

-- ============================================================
-- 9. readiness_signals (optional — only queried, not written by v1)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.readiness_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  value       numeric NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.readiness_signals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_readiness_signals_user_id
  ON public.readiness_signals (user_id);

CREATE INDEX IF NOT EXISTS idx_readiness_signals_user_captured
  ON public.readiness_signals (user_id, captured_at DESC);

-- ============================================================
-- 10. Atomic session counter decrement function
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_session_counter(
  p_entitlement_id uuid,
  p_week_start timestamptz,
  p_weekly_limit int
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_remaining int;
BEGIN
  UPDATE public.entitlements
  SET
    weekly_pro_sessions_remaining = CASE
      WHEN weekly_sessions_reset_at < p_week_start THEN p_weekly_limit - 1
      ELSE weekly_pro_sessions_remaining - 1
    END,
    weekly_sessions_reset_at = CASE
      WHEN weekly_sessions_reset_at < p_week_start THEN now()
      ELSE weekly_sessions_reset_at
    END
  WHERE id = p_entitlement_id
    AND (CASE
      WHEN weekly_sessions_reset_at < p_week_start THEN p_weekly_limit
      ELSE weekly_pro_sessions_remaining
    END) > 0
  RETURNING weekly_pro_sessions_remaining INTO v_remaining;

  RETURN COALESCE(v_remaining, -1);
END;
$$;
