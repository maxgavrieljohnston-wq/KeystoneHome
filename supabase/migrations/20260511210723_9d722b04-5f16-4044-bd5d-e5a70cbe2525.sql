alter table public.plans add column if not exists title text;

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_created_idx
  on public.coach_messages(user_id, created_at);

alter table public.coach_messages enable row level security;

create policy "Users read own coach messages"
  on public.coach_messages for select
  using (auth.uid() = user_id);

create policy "Service role manages coach messages"
  on public.coach_messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');