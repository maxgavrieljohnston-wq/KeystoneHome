## Goal
Create 5 ready-to-use test logins. Each has a fake name, full financial profile (income, expenses, debt, savings), and a home target (location + style) — so when you sign in, a real plan is already built.

## The 5 personas

| # | Name | Age | Location | Home target | Income | Expenses | Debt | Saved | Timeline |
|---|------|-----|----------|-------------|--------|----------|------|-------|----------|
| 1 | Maya Chen | 26, single | Austin, TX | 1BR condo (~$340k) | $72k | $2,400/mo | $5,200 | $4,800 | 4 yrs |
| 2 | Marcus & Tina Rivera | 31 + 30, couple | Charlotte, NC | 3BR townhouse (~$410k) | $145k joint | $4,100/mo | $18,000 | $32,000 | 2.5 yrs |
| 3 | Priya Shah | 38, single | Seattle, WA | 2BR condo (~$680k) | $215k | $5,800/mo | $0 | $95,000 | ~1 yr |
| 4 | David & Amara Okafor | 41 + 39, family of 4 | Phoenix, AZ | 4BR single-family (~$465k) | $118k joint | $5,400/mo | $11,000 | $22,000 | 5 yrs (stretched) |
| 5 | Jordan Bailey | 29, freelancer | Denver, CO | 2BR townhouse (~$525k) | $98k | $3,200/mo | $3,500 | $68,000 | 9 mo (near-ready) |

Coverage: early-career renter, mid-career couple, high-income single, tight-budget family, and a near-ready buyer — different metros, home styles, and timeline pressure.

## Login credentials
- Emails: `test1@keystone.test` … `test5@keystone.test`
- Shared password: `KeystoneTest!2026`
- I'll print the full list (name + email + password) when seeding completes so you can log in.

## How it's built

1. **One-off seed script** (`scripts/seed-test-accounts.ts`, run locally via `bun`) using the Supabase service-role key to:
   - Call `auth.admin.createUser()` for each persona (email-confirmed, no email sent)
   - The existing `handle_new_user` trigger auto-creates each `profiles` row; the script then updates `display_name` to the persona's full name
   - Insert one row into `public.plans` per user with a complete `answers` JSON matching the questionnaire shape (age, zip, income, expenses, debt, saved, credit, homeStyle, beds/baths, timelineYears, partner fields, lifestyle/neighborhood prefs, riskAnswers, downGoalPct, zipData with metro + avg price)
2. **Idempotent**: re-running deletes & recreates the 5 test users + their plans so you always get a clean slate.
3. **Script is NOT shipped to production** — it lives in `scripts/`, never imported by the app, and uses env vars from `.env`.

## Files touched
- `scripts/seed-test-accounts.ts` — new, runnable with `bun scripts/seed-test-accounts.ts`
- No app code or database schema changes
- No new RLS policies (existing service-role policies cover the inserts)

## After approval
I'll write the script, run it once, and report back with the 5 logins + which dashboard each one lands on (so you know what to expect when you sign in as each).
