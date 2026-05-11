
# Capture Emails into Lovable Cloud

Skip payments for now. Goal: actually save the email (already collected at step 2) plus the user's full flow answers, so you have a real lead list.

## Step 1 — Enable Lovable Cloud
Required to store data. No external accounts.

## Step 2 — `leads` table
Columns:
- `id` uuid pk
- `email` text (unique)
- `created_at` timestamptz
- `updated_at` timestamptz
- `completed` bool — true once they reach the final results page
- `answers` jsonb — full flow state snapshot (income, zip, partner info, timeline, etc.)

RLS: allow anonymous `insert` and `update` by matching email; no public `select` (you'll read leads from the Cloud dashboard).

## Step 3 — Save on email entry
As soon as the user submits their email on the email step, upsert a `leads` row with that email and a partial `answers` snapshot. This way you capture leads even if they bail mid-flow.

## Step 4 — Update on completion
When they reach the final "Your Plan" page, update the same row: set `completed = true` and overwrite `answers` with the full final snapshot.

## Technical notes
- One `createServerFn` (`upsertLead`) called from the existing email step and again from the results screen.
- Match on lowercased/trimmed email.
- Silent failure — never block the user's flow if the save errors; just log.

## Out of scope
Payments, sending emails, admin UI, auth. Easy to add later.
