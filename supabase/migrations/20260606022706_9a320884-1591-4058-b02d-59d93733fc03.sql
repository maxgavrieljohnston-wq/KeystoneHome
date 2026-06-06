
-- Replace the partial unique index with a plain unique constraint so
-- PostgREST upserts on stripe_subscription_id can match it. NULLs are
-- treated as distinct in PG unique indexes, so legacy paddle rows are OK.
DROP INDEX IF EXISTS public.subscriptions_stripe_subscription_id_key;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
