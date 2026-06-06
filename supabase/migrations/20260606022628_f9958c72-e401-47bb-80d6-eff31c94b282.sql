
-- The Stripe webhook upserts on stripe_subscription_id, but no unique constraint
-- existed, causing every Stripe purchase to silently fail to record. Add it.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
