-- 1. Rotate hardcoded test account passwords and remove their live subscriptions
DO $$
DECLARE
  v_emails text[] := ARRAY['plus@test.keystone.dev','pro@test.keystone.dev','protest@keystone.test'];
  v_email text;
  v_uid uuid;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
    IF v_uid IS NOT NULL THEN
      UPDATE auth.users
        SET encrypted_password = crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
            updated_at = now()
        WHERE id = v_uid;
      DELETE FROM public.subscriptions WHERE user_id = v_uid AND environment = 'live';
    END IF;
  END LOOP;
END $$;

-- 2. Restrict admin analytics RPC to service_role only
REVOKE EXECUTE ON FUNCTION public.get_upgrade_funnel(timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_upgrade_funnel(timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_upgrade_funnel(timestamptz) TO service_role;

-- 3. Prevent anonymous fake checkout_success events
CREATE OR REPLACE FUNCTION public.log_upgrade_event(
  p_event_type text,
  p_source text,
  p_tier text,
  p_session_id text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_plan_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
begin
  if p_event_type not in ('cta_click','checkout_open','checkout_success') then
    raise exception 'invalid event_type';
  end if;
  if p_tier not in ('plus','pro') then
    raise exception 'invalid tier';
  end if;
  if p_source is null or length(p_source) = 0 or length(p_source) > 64 then
    raise exception 'invalid source';
  end if;
  -- checkout_success may only be logged for authenticated users; the webhook
  -- writes directly via service_role and bypasses this RPC.
  if p_event_type = 'checkout_success' and v_user_id is null then
    raise exception 'unauthenticated checkout_success not allowed';
  end if;

  insert into public.upgrade_events (
    event_type, source, tier, user_id, email, session_id, plan_id, metadata
  ) values (
    p_event_type,
    p_source,
    p_tier,
    v_user_id,
    nullif(lower(trim(p_email)), ''),
    nullif(p_session_id, ''),
    p_plan_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$function$;