
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  completed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Anyone (anon) can insert a lead
create policy "anyone can insert leads"
  on public.leads for insert
  to anon, authenticated
  with check (true);

-- Anyone can update a lead row (matched by email server-side)
create policy "anyone can update leads"
  on public.leads for update
  to anon, authenticated
  using (true)
  with check (true);

-- No select policy => no public read access

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();
