-- Weekly Report Requests — logs every successful submission
create table if not exists weekly_report_requests (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null,
  match_day              text not null,
  weekly_load            smallint not null,
  legs_status            text not null,
  tissue_focus           text not null,
  include_speed_exposure boolean not null default false,
  recovery_mode          text not null default 'Walk',
  teammate_code          text,
  created_at             timestamptz not null default now()
);

-- Index for the 7-day rate-limit lookup
create index if not exists idx_wrr_email_created
  on weekly_report_requests (email, created_at desc);

-- Follow-up reminders (teammate-only, "Email me in 7 days")
create table if not exists weekly_report_followups (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  send_at           timestamptz not null,
  report_request_id uuid not null references weekly_report_requests(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_wrf_send_at
  on weekly_report_followups (send_at);

-- Row Level Security — block direct access, API uses service_role key
alter table weekly_report_requests enable row level security;
alter table weekly_report_followups enable row level security;

revoke all on weekly_report_requests from anon, authenticated;
revoke all on weekly_report_followups from anon, authenticated;

grant all on weekly_report_requests to service_role;
grant all on weekly_report_followups to service_role;
