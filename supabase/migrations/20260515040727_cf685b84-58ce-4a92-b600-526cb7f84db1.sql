
CREATE TABLE public.broker_match_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID,
  service_type TEXT NOT NULL CHECK (service_type IN ('mortgage','realtor','both')),
  target_city TEXT,
  target_state TEXT,
  target_zip TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  timeline TEXT,
  loan_type TEXT,
  credit_band TEXT,
  first_time_buyer BOOLEAN DEFAULT false,
  buyer_or_seller TEXT,
  property_type TEXT,
  preferred_language TEXT,
  contact_method TEXT,
  contact_time TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','introduced','closed','cancelled')),
  tier_at_signup TEXT NOT NULL DEFAULT 'free',
  priority BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_match_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages broker match requests"
  ON public.broker_match_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view own broker match requests"
  ON public.broker_match_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own broker match requests"
  ON public.broker_match_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own broker match requests"
  ON public.broker_match_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own broker match requests"
  ON public.broker_match_requests FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_broker_match_requests_updated_at
  BEFORE UPDATE ON public.broker_match_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_broker_match_requests_user ON public.broker_match_requests(user_id, created_at DESC);
