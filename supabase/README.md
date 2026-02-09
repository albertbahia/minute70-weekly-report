# Supabase Schema Migrations

## Overview

Every schema change to the Supabase PROD database must be captured as a
migration file in `supabase/migrations/`. Migrations are applied automatically
via GitHub Actions when merged to `main`.

## Migration Conventions

### Naming

```
YYYYMMDDHHMM_description.sql
```

Example: `202602091430_add_tier_column.sql`

### Writing Migrations

- Use **additive, idempotent** SQL where possible:
  - `CREATE TABLE IF NOT EXISTS ...`
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
  - `CREATE INDEX IF NOT EXISTS ...`
  - `DROP TABLE IF EXISTS ...` (for removals)
- Each file runs in order by timestamp prefix.
- Test migrations locally before pushing.

## Release Order

1. Develop on `dev` branch, open PR to `main`.
2. PR triggers **Migration Hygiene Check** (validates naming/ordering).
3. Merge PR to `main`.
4. If `supabase/migrations/**` files changed, GitHub Actions triggers
   **Supabase Migrate PROD** (requires `prod` environment approval).
5. Approve the workflow run in GitHub Actions.
6. Verify the post-migration drift check passes (green).
7. Vercel auto-deploys code from `main`.

**Important:** Vercel auto-deploys from `main`. The GitHub Actions
"Supabase Migrate PROD" workflow should be approved and green before
considering a release complete. Schema changes must land before code
that depends on them.

## GitHub Secrets (Environment: `prod`)

These must be configured in the GitHub repository settings under the
`prod` environment:

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN_PROD` | Supabase personal access token |
| `SUPABASE_PROJECT_REF_PROD` | Supabase project reference ID |
| `SUPABASE_DB_PASSWORD_PROD` | Supabase database password |
