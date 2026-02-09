-- Baseline: create core tables if they don't exist (safe for empty PROD)

-- Weekly Report Requests — logs every successful submission
CREATE TABLE IF NOT EXISTS public.weekly_report_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text NOT NULL,
  match_day              text NOT NULL,
  weekly_load            smallint NOT NULL,
  legs_status            text NOT NULL,
  tissue_focus           text NOT NULL DEFAULT 'Quads',
  include_speed_exposure boolean NOT NULL DEFAULT false,
  recovery_mode          text NOT NULL DEFAULT 'Walk',
  half_length_minutes    integer NOT NULL DEFAULT 25,
  teammate_code          text,
  tier                   text NOT NULL DEFAULT 'free',
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes for rate-limit lookup
CREATE INDEX IF NOT EXISTS idx_wrr_email_created
  ON public.weekly_report_requests (email, created_at DESC);

-- Follow-up reminders (teammate-only, "Email me in 7 days")
CREATE TABLE IF NOT EXISTS public.weekly_report_followups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  send_at           timestamptz NOT NULL,
  report_request_id uuid NOT NULL REFERENCES public.weekly_report_requests(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wrf_send_at
  ON public.weekly_report_followups (send_at);

-- Waitlist signups
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security — block direct access, API uses service_role key
ALTER TABLE public.weekly_report_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weekly_report_requests FROM anon, authenticated;
REVOKE ALL ON public.weekly_report_followups FROM anon, authenticated;
REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;

GRANT ALL ON public.weekly_report_requests TO service_role;
GRANT ALL ON public.weekly_report_followups TO service_role;
GRANT ALL ON public.waitlist_signups TO service_role;
