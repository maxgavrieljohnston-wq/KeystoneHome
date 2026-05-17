
-- 1. Events table
create table if not exists public.upgrade_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('cta_click','checkout_open','checkout_success')),
  source text not null,
  tier text not null check (tier in ('plus','pro')),
  user_id uuid,
  email text,
  session_id text,
  plan_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists upgrade_events_source_created_idx
  on public.upgrade_events (source, created_at desc);
create index if not exists upgrade_events_session_idx
  on public.upgrade_events (session_id);
create index if not exists upgrade_events_user_idx
  on public.upgrade_events (user_id);
create index if not exists upgrade_events_event_type_idx
  on public.upgrade_events (event_type, created_at desc);

alter table public.upgrade_events enable row level security;

drop policy if exists "Service role manages upgrade events" on public.upgrade_events;
create policy "Service role manages upgrade events"
  on public.upgrade_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 2. Logging RPC (callable from anon/authenticated, validates input)
create or replace function public.log_upgrade_event(
  p_event_type text,
  p_source text,
  p_tier text,
  p_session_id text default null,
  p_email text default null,
  p_plan_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.log_upgrade_event(text, text, text, text, text, uuid, jsonb)
  to anon, authenticated;

-- 3. Attribution column on subscriptions
alter table public.subscriptions
  add column if not exists attribution_source text;

-- 4. Funnel aggregator for the admin view
create or replace function public.get_upgrade_funnel(p_since timestamptz)
returns table(
  source text,
  tier text,
  clicks bigint,
  checkout_opens bigint,
  signups bigint
)
language sql
security definer
set search_path = public
as $$
  select
    e.source,
    e.tier,
    count(*) filter (where e.event_type = 'cta_click')        as clicks,
    count(*) filter (where e.event_type = 'checkout_open')    as checkout_opens,
    count(*) filter (where e.event_type = 'checkout_success') as signups
  from public.upgrade_events e
  where e.created_at >= p_since
  group by e.source, e.tier
  order by signups desc, clicks desc;
$$;

grant execute on function public.get_upgrade_funnel(timestamptz)
  to authenticated, service_role;
