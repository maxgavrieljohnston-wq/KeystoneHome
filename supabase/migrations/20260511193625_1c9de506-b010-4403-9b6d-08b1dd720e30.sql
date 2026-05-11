
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index plans_email_lower_idx on public.plans (lower(email));
create index plans_user_id_idx on public.plans (user_id);

alter table public.plans enable row level security;

create policy "Users can view own plans"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "Service role can manage plans"
  on public.plans for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Returns: { ok bool, reason text, plan_id uuid, used int, limit int }
create or replace function public.create_plan_with_limit(
  p_email text,
  p_user_id uuid,
  p_answers jsonb,
  p_environment text default 'live'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.plans (email, user_id, answers)
  values (v_email, p_user_id, coalesce(p_answers, '{}'::jsonb))
  returning id into v_plan_id;

  return jsonb_build_object(
    'ok', true,
    'plan_id', v_plan_id,
    'used', coalesce(v_used, 0) + 1,
    'limit', case when v_is_paid then null else v_limit end,
    'is_paid', v_is_paid
  );
end;
$$;
