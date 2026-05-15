DO $$
DECLARE
  v_emails text[];
  v_ids uuid[];
BEGIN
  SELECT array_agg(lower(email)), array_agg(id)
    INTO v_emails, v_ids
  FROM auth.users
  WHERE raw_app_meta_data->>'provider' = 'email';

  IF v_ids IS NULL THEN RETURN; END IF;

  DELETE FROM public.coach_messages WHERE user_id = ANY(v_ids);
  DELETE FROM public.rate_alerts WHERE user_id = ANY(v_ids);
  DELETE FROM public.broker_waitlist WHERE user_id = ANY(v_ids);
  DELETE FROM public.subscriptions WHERE user_id = ANY(v_ids);
  DELETE FROM public.plans WHERE user_id = ANY(v_ids) OR lower(email) = ANY(v_emails);
  DELETE FROM public.profiles WHERE user_id = ANY(v_ids);
  DELETE FROM public.leads WHERE lower(email) = ANY(v_emails);
  DELETE FROM public.email_send_log WHERE lower(recipient_email) = ANY(v_emails);
  DELETE FROM public.email_unsubscribe_tokens WHERE lower(email) = ANY(v_emails);
  DELETE FROM public.suppressed_emails WHERE lower(email) = ANY(v_emails);
  DELETE FROM auth.identities WHERE user_id = ANY(v_ids);
  DELETE FROM auth.users WHERE id = ANY(v_ids);
END $$;