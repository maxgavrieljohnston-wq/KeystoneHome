# Fix: restore test login credentials

## Diagnosis
- `plus@test.keystone.dev` and `pro@test.keystone.dev` still exist in `auth.users` and are email-confirmed (verified via `read_query`).
- The Plus user signed in successfully earlier today, then signed out. Subsequent `POST /auth/v1/token?grant_type=password` calls with `PlusTest123!` and `ProTest123!` return `invalid_credentials` (HTTP 400).
- Account state is fine; the stored `encrypted_password` no longer matches the original test passwords. Something (a re-seed, manual change, or an auth setting toggle) overwrote them.

## Fix
Run a one-shot migration that resets the encrypted password on those two rows back to the documented values, leaving everything else (id, email_confirmed_at, subscriptions, leads) untouched:

```sql
update auth.users
set encrypted_password = crypt('PlusTest123!', gen_salt('bf')),
    updated_at = now()
where email = 'plus@test.keystone.dev';

update auth.users
set encrypted_password = crypt('ProTest123!', gen_salt('bf')),
    updated_at = now()
where email = 'pro@test.keystone.dev';
```

(`pgcrypto` is already available in Supabase projects, so `crypt()` / `gen_salt()` work without extra setup.)

## After the migration
Credentials to use:
- Plus: `plus@test.keystone.dev` / `PlusTest123!`
- Pro:  `pro@test.keystone.dev` / `ProTest123!`

No app code changes are needed — the existing Plus subscription row for the Plus user is still active in sandbox, so tier gating will keep working as before.

## Optional follow-up (only if you want)
Add a tiny seed migration that always upserts these two users + their sandbox subscriptions, so a future re-seed/reset can never silently break the bypass logins again. Skip unless you want me to do it.
