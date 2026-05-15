
-- ============ Market snapshots cache ============
create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (city, state)
);

alter table public.market_snapshots enable row level security;

create policy "Service role manages market snapshots"
on public.market_snapshots for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index idx_market_snapshots_city_state on public.market_snapshots (lower(city), lower(state));

-- ============ Lender document vault ============
create type public.lender_doc_item as enum (
  'w2',
  'tax_return',
  'pay_stub',
  'bank_statement',
  'id',
  'gift_letter',
  'employment_letter',
  'other'
);

create table public.lender_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  checklist_item public.lender_doc_item not null,
  file_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text,
  status text not null default 'uploaded',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lender_documents enable row level security;

create policy "Users view own lender documents"
on public.lender_documents for select
using (auth.uid() = user_id);

create policy "Users insert own lender documents"
on public.lender_documents for insert
with check (auth.uid() = user_id);

create policy "Users update own lender documents"
on public.lender_documents for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users delete own lender documents"
on public.lender_documents for delete
using (auth.uid() = user_id);

create policy "Service role manages lender documents"
on public.lender_documents for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index idx_lender_documents_user on public.lender_documents (user_id, checklist_item);

create trigger trg_lender_documents_updated_at
before update on public.lender_documents
for each row execute function public.set_updated_at();

-- ============ Private storage bucket for lender docs ============
insert into storage.buckets (id, name, public)
values ('lender-docs', 'lender-docs', false)
on conflict (id) do nothing;

create policy "Users read own lender doc files"
on storage.objects for select
using (
  bucket_id = 'lender-docs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users upload own lender doc files"
on storage.objects for insert
with check (
  bucket_id = 'lender-docs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users delete own lender doc files"
on storage.objects for delete
using (
  bucket_id = 'lender-docs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
