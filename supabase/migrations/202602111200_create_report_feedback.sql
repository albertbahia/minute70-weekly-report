-- Anonymous report feedback table (no email, no user_id, no IP)
CREATE TABLE IF NOT EXISTS public.report_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  feedback_choice text NOT NULL,
  feedback_other text,
  report_context jsonb
);

ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;
