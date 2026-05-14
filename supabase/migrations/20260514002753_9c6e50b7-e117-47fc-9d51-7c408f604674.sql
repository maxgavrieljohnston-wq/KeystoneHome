create table if not exists public.rate_alerts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_rate numeric(5,4) not null check (target_rate > 0 and target_rate < 0.30),
  loan_amount numeric(12,2) not null check (loan_amount >= 0),
  active boolean not null default true,
  email_notifications boolean not null default true,
  last_notified_at timestamptz,
  last_seen_rate numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rate_alerts enable row level security;

create policy "Users can view own rate alert"
  on public.rate_alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert own rate alert"
  on public.rate_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rate alert"
  on public.rate_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own rate alert"
  on public.rate_alerts for delete
  using (auth.uid() = user_id);

create policy "Service role manages rate alerts"
  on public.rate_alerts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.touch_rate_alerts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rate_alerts_updated_at on public.rate_alerts;
create trigger trg_rate_alerts_updated_at
before update on public.rate_alerts
for each row execute function public.touch_rate_alerts_updated_at();