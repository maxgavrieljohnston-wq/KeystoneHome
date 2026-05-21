-- Add Stripe ID columns and relax NOT NULL on legacy Paddle columns so the
-- subscriptions table can accept Stripe webhook upserts.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.subscriptions
  ALTER COLUMN paddle_subscription_id DROP NOT NULL,
  ALTER COLUMN paddle_customer_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;