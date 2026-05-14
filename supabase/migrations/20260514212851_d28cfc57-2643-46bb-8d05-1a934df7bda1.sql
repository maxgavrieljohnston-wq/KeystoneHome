
CREATE TABLE public.broker_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  tier_at_signup text NOT NULL DEFAULT 'free',
  priority boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.broker_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own waitlist entry"
  ON public.broker_waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages broker waitlist"
  ON public.broker_waitlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.join_broker_waitlist(p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_is_pro boolean;
  v_is_plus boolean;
  v_tier text := 'free';
  v_priority boolean := false;
  v_price_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
  END IF;

  SELECT price_id INTO v_price_id
  FROM public.subscriptions
  WHERE user_id = v_user_id
    AND ((status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))
         OR (status = 'canceled' AND current_period_end > now()))
  ORDER BY created_at DESC
  LIMIT 1;

  v_is_pro := v_price_id IN ('pro_monthly', 'pro_yearly');
  v_is_plus := v_price_id IN ('plus_monthly', 'plus_yearly');

  IF v_is_pro THEN
    v_tier := 'pro';
    v_priority := true;
  ELSIF v_is_plus THEN
    v_tier := 'plus';
    v_priority := false;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'requires_paid_plan');
  END IF;

  INSERT INTO public.broker_waitlist (user_id, email, tier_at_signup, priority, notes)
  VALUES (v_user_id, v_email, v_tier, v_priority, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET tier_at_signup = EXCLUDED.tier_at_signup,
        priority = EXCLUDED.priority,
        notes = COALESCE(EXCLUDED.notes, public.broker_waitlist.notes);

  RETURN jsonb_build_object('ok', true, 'tier', v_tier, 'priority', v_priority);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_broker_waitlist(text) TO authenticated, anon;
