CREATE OR REPLACE FUNCTION public.upsert_lead(
  p_email text, 
  p_answers jsonb, 
  p_completed boolean, 
  p_first_name text DEFAULT NULL, 
  p_last_name text DEFAULT NULL, 
  p_phone text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid email';
  end if;

  insert into public.leads (email, answers, completed, first_name, last_name, phone)
  values (v_email, coalesce(p_answers, '{}'::jsonb), coalesce(p_completed, false), p_first_name, p_last_name, p_phone)
  on conflict (email) do update
    set answers = excluded.answers,
        completed = public.leads.completed or excluded.completed,
        first_name = COALESCE(excluded.first_name, public.leads.first_name),
        last_name = COALESCE(excluded.last_name, public.leads.last_name),
        phone = COALESCE(excluded.phone, public.leads.phone);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_plan_with_limit(
  p_email text, 
  p_user_id uuid, 
  p_answers jsonb, 
  p_environment text DEFAULT 'live'::text, 
  p_first_name text DEFAULT NULL, 
  p_last_name text DEFAULT NULL, 
  p_phone text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_used int;
  v_is_paid boolean;
  v_plan_id uuid;
  v_limit constant int := 3;
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;

  -- Check paid status: any active/trialing subscription tied to this email
  -- (joined via auth.users) OR to the supplied user_id.
  select exists(
    select 1
    from public.subscriptions s
    left join auth.users u on u.id = s.user_id
    where s.environment = p_environment
      and (
        s.user_id = p_user_id
        or lower(u.email) = v_email
      )
      and (
        (s.status in ('active','trialing')
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  ) into v_is_paid;

  if not v_is_paid then
    select count(*) into v_used from public.plans where lower(email) = v_email;
    if v_used >= v_limit then
      return jsonb_build_object(
        'ok', false,
        'reason', 'limit_reached',
        'used', v_used,
        'limit', v_limit
      );
    end if;
  end if;

  insert into public.plans (email, user_id, answers, first_name, last_name, phone)
  values (v_email, p_user_id, coalesce(p_answers, '{}'::jsonb), p_first_name, p_last_name, p_phone)
  returning id into v_plan_id;

  return jsonb_build_object(
    'ok', true,
    'plan_id', v_plan_id,
    'used', coalesce(v_used, 0) + 1,
    'limit', case when v_is_paid then null else v_limit end,
    'is_paid', v_is_paid
  );
end;
$function$;