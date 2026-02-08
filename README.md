# Minute70 Weekly Report

A single-page Next.js app for submitting weekly status reports, backed by Supabase.

## Features

- **Follow-up reminders** — teammates can opt-in to a 7-day email reminder (stored in `weekly_report_followups`)
- **Server-only secrets** — Supabase service-role key never leaves the server

## Local Development

### 1. Set up Supabase

Create a project at [supabase.com](https://supabase.com) and run the schema:

```sql
-- paste the contents of supabase_schema.sql into the Supabase SQL Editor
```

Or use the CLI:

```bash
psql "$DATABASE_URL" -f supabase_schema.sql
```

### 2. Environment variables

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://abc.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key from Supabase → Settings → API |

Both are **server-only** — they are only used in API routes and are never sent to the browser.

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000/weekly-report](http://localhost:3000/weekly-report).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. Add the two environment variables in the Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

## Database Tables

### `weekly_report_requests`

Logs every successful submission.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `email` | text | Lowercased on insert |
| `name` | text | |
| `accomplishments` | text | |
| `goals` | text | |
| `blockers` | text | Nullable |
| `teammate_code` | text | Set to `ELMPARC2FREE` if used |
| `created_at` | timestamptz | Defaults to `now()` |

### `weekly_report_followups`

Stores "email me in 7 days" opt-ins (teammate-only).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `email` | text | |
| `name` | text | |
| `send_at` | timestamptz | `now() + 7 days` |
| `report_request_id` | uuid | FK → `weekly_report_requests.id` |
| `created_at` | timestamptz | Defaults to `now()` |
