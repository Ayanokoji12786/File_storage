-- Nimbus — database schema.
-- Run this in the Supabase dashboard → SQL Editor for a fresh project.

-- 1. Files table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  size bigint not null default 0,
  mime_type text not null default '',
  category text not null default 'other',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_owner_created_idx on public.files (owner_id, created_at desc);
create index if not exists files_owner_category_idx on public.files (owner_id, category);

-- 2. Row Level Security: each user only touches their own rows
alter table public.files enable row level security;

create policy "read own or public files" on public.files
  for select using (auth.uid() = owner_id or is_public = true);
create policy "insert own files" on public.files
  for insert with check (auth.uid() = owner_id);
create policy "update own files" on public.files
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "delete own files" on public.files
  for delete using (auth.uid() = owner_id);

-- 3. Private storage bucket
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

-- 4. Storage policies: users only in their own {uid}/ folder
create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
