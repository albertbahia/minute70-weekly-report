# Release Checklist

Use this checklist for every release that includes schema changes.

## Steps

- [ ] Create migration file(s) in `supabase/migrations/` (naming: `YYYYMMDDHHMM_description.sql`)
- [ ] Test migration SQL locally
- [ ] Push to `dev` branch, open PR to `main`
- [ ] Verify **Migration Hygiene Check** passes on PR
- [ ] Get PR review approval, merge to `main`
- [ ] **Supabase Migrate PROD** workflow triggers in GitHub Actions
- [ ] Approve the `prod` environment deployment in GitHub Actions
- [ ] Verify post-migration drift check passes (green)
- [ ] Confirm Vercel auto-deploy from `main` succeeds

## Key Principle

> Migrations first, then deploy. Schema changes must be applied before
> code that depends on them goes live.

## Code-Only Releases

If a release has no schema changes, skip the migration steps.
Vercel auto-deploys from `main` as usual.
