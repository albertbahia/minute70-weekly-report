-- Weekly Report Requests — logs every successful submission
create table if not exists weekly_report_requests (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  accomplishments text not null,
  goals         text not null,
  blockers      text,
  teammate_code text,
  created_at    timestamptz not null default now()
);

-- Index for the 7-day rate-limit lookup
create index if not exists idx_wrr_email_created
  on weekly_report_requests (email, created_at desc);

-- Follow-up reminders (teammate-only, "Email me in 7 days")
create table if not exists weekly_report_followups (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  name              text not null,
  send_at           timestamptz not null,
  report_request_id uuid not null references weekly_report_requests(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_wrf_send_at
  on weekly_report_followups (send_at);
