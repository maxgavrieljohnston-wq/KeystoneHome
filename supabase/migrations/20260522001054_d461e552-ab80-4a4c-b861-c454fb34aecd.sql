
-- Cleanup: delete test1-5 accounts and their data
DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    '362d715a-b4d3-473a-bd6a-2f9e4eb5b023'::uuid,
    'ea45f1ec-5f55-407f-b746-0f00121e1b42'::uuid,
    '0726090e-2d23-4318-8e13-ad881da6db33'::uuid,
    '5bacb2ef-9bb1-4fa8-ae48-5bc278e3a3bc'::uuid,
    '6c360d3f-d423-413e-8a18-a23a9692c25a'::uuid
  ];
BEGIN
  DELETE FROM public.subscriptions WHERE user_id = ANY(v_ids);
  DELETE FROM public.plans WHERE user_id = ANY(v_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(v_ids);
  DELETE FROM public.coach_messages WHERE user_id = ANY(v_ids);
  DELETE FROM public.rate_alerts WHERE user_id = ANY(v_ids);
  DELETE FROM public.broker_waitlist WHERE user_id = ANY(v_ids);
  DELETE FROM public.broker_match_requests WHERE user_id = ANY(v_ids);
  DELETE FROM public.lender_documents WHERE user_id = ANY(v_ids);
  DELETE FROM public.upgrade_events WHERE user_id = ANY(v_ids);
  DELETE FROM auth.identities WHERE user_id = ANY(v_ids);
  DELETE FROM auth.users WHERE id = ANY(v_ids);
END $$;

-- Create new pro test account
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_email text := 'protest@keystone.test';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, crypt('TestPro2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pro Test"}',
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (v_uid, 'Pro Test')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id, status, price_id, product_id, environment,
    current_period_start, current_period_end
  ) VALUES
    (v_uid, 'active', 'pro_monthly', 'prod_pro_test', 'sandbox', now(), now() + interval '30 days'),
    (v_uid, 'active', 'pro_monthly', 'prod_pro_test', 'live',    now(), now() + interval '30 days');
END $$;
