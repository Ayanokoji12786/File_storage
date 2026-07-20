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
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_owner_created_idx on public.files (owner_id, created_at desc);
create index if not exists files_owner_category_idx on public.files (owner_id, category);
create index if not exists files_owner_hash_idx on public.files (owner_id, content_hash);

-- Migration for databases created before duplicate detection:
--   alter table public.files add column if not exists content_hash text;
--   create index if not exists files_owner_hash_idx on public.files (owner_id, content_hash);

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

-- ------------------------------------------------------------------
-- AI: semantic index (pgvector). Run this whole block as a migration
-- on databases created before the AI features.
-- ------------------------------------------------------------------

create extension if not exists vector;

alter table public.files add column if not exists index_status text not null default 'pending';

create table if not exists public.file_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  owner_id uuid not null,
  chunk_index int not null,
  content text not null,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

create index if not exists file_chunks_file_idx on public.file_chunks (file_id);
create index if not exists file_chunks_owner_idx on public.file_chunks (owner_id);

alter table public.file_chunks enable row level security;

drop policy if exists "read own chunks" on public.file_chunks;
create policy "read own chunks" on public.file_chunks
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.match_file_chunks(
  query_embedding vector(1024),
  match_owner_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  file_id uuid,
  chunk_index int,
  content text,
  similarity double precision
)
language sql stable
as $$
  select
    fc.id,
    fc.file_id,
    fc.chunk_index,
    fc.content,
    1 - (fc.embedding <=> query_embedding) as similarity
  from public.file_chunks fc
  where fc.owner_id = match_owner_id
    and fc.embedding is not null
  order by fc.embedding <=> query_embedding
  limit match_count;
$$;

notify pgrst, 'reload schema';
