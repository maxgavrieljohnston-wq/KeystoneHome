
-- Remove permissive direct-write policies
drop policy if exists "anyone can insert leads" on public.leads;
drop policy if exists "anyone can update leads" on public.leads;

-- Fix mutable search_path on trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Single entrypoint for lead capture (security definer bypasses RLS safely)
create or replace function public.upsert_lead(p_email text, p_answers jsonb, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid email';
  end if;

  insert into public.leads (email, answers, completed)
  values (v_email, coalesce(p_answers, '{}'::jsonb), coalesce(p_completed, false))
  on conflict (email) do update
    set answers = excluded.answers,
        completed = public.leads.completed or excluded.completed;
end;
$$;

revoke all on function public.upsert_lead(text, jsonb, boolean) from public;
grant execute on function public.upsert_lead(text, jsonb, boolean) to anon, authenticated;
