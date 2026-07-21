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

drop policy if exists "read own or public files" on public.files;
create policy "read own or public files" on public.files
  for select using (auth.uid() = owner_id or is_public = true);
drop policy if exists "insert own files" on public.files;
create policy "insert own files" on public.files
  for insert with check (auth.uid() = owner_id);
drop policy if exists "update own files" on public.files;
create policy "update own files" on public.files
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "delete own files" on public.files;
create policy "delete own files" on public.files
  for delete using (auth.uid() = owner_id);

-- 3. Private storage bucket
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

-- 4. Storage policies: users only in their own {uid}/ folder
drop policy if exists "upload to own folder" on storage.objects;
create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "read own objects" on storage.objects;
create policy "read own objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own objects" on storage.objects;
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

-- ------------------------------------------------------------------
-- Tier 4: profiles, direct sharing, notifications, encryption /
-- compression / thumbnail metadata. Run this whole block as a migration
-- on databases created before these features. Safe to re-run.
-- ------------------------------------------------------------------

-- Profiles mirror auth.users so "share by email" can resolve to a user id
-- without exposing the auth schema to the client.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated
  using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name' from auth.users
on conflict (id) do nothing;

-- Direct file shares: owner -> a specific recipient (distinct from the
-- public `is_public` link toggle).
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (file_id, shared_with_user_id)
);

create index if not exists shares_recipient_idx on public.shares (shared_with_user_id);
create index if not exists shares_owner_idx on public.shares (owner_id);

alter table public.shares enable row level security;

drop policy if exists "read own shares" on public.shares;
create policy "read own shares" on public.shares
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = shared_with_user_id);

drop policy if exists "create shares for own files" on public.shares;
create policy "create shares for own files" on public.shares
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
  );

drop policy if exists "delete own shares" on public.shares;
create policy "delete own shares" on public.shares
  for delete to authenticated
  using (auth.uid() = owner_id);

-- Let recipients read files shared directly with them (extends the
-- original owner-or-public policy from section 2).
drop policy if exists "read own or public files" on public.files;
create policy "read own or public files" on public.files
  for select using (
    auth.uid() = owner_id
    or is_public = true
    or exists (
      select 1 from public.shares s
      where s.file_id = files.id and s.shared_with_user_id = auth.uid()
    )
  );

-- Notifications (e.g. "John shared a file with you"). FKs point at
-- `profiles` (not `auth.users`) so PostgREST can embed the actor's name.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  file_id uuid references public.files(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

-- The sharer inserts a row for the recipient; only allowed to act as themself.
drop policy if exists "insert notifications as actor" on public.notifications;
create policy "insert notifications as actor" on public.notifications
  for insert to authenticated
  with check (auth.uid() = actor_id);

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enable Realtime (postgres_changes) on notifications for the bell icon.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Files: encryption / compression / thumbnail metadata.
alter table public.files add column if not exists is_encrypted boolean not null default false;
alter table public.files add column if not exists encryption_iv text;
alter table public.files add column if not exists encryption_salt text;
alter table public.files add column if not exists is_compressed boolean not null default false;
alter table public.files add column if not exists original_mime_type text;
alter table public.files add column if not exists thumbnail_path text;

-- Raise the per-object size cap so chunked/resumable uploads can reach 20GB.
-- (The project-wide Storage limit in the Supabase dashboard must also allow
-- this — see README.)
update storage.buckets set file_size_limit = 21474836480 where id = 'files';

notify pgrst, 'reload schema';

-- ------------------------------------------------------------------
-- Trash: soft-delete. Deleting a file sets `deleted_at` instead of removing
-- the row; the app purges rows older than 30 days (see getTrashedFiles) and
-- only then removes the Storage object. Safe to re-run.
-- ------------------------------------------------------------------

alter table public.files add column if not exists deleted_at timestamptz;

create index if not exists files_owner_deleted_idx on public.files (owner_id, deleted_at);

-- Owners keep full access to their own trashed files (needed for the Trash
-- view); public links and direct shares stop working the moment a file is
-- trashed, even though the row still exists.
drop policy if exists "read own or public files" on public.files;
create policy "read own or public files" on public.files
  for select using (
    auth.uid() = owner_id
    or (
      deleted_at is null
      and (
        is_public = true
        or exists (
          select 1 from public.shares s
          where s.file_id = files.id and s.shared_with_user_id = auth.uid()
        )
      )
    )
  );

notify pgrst, 'reload schema';

-- ==================================================================
-- SECURITY & PERFORMANCE HARDENING
-- Addresses the audit findings. Idempotent — safe to re-run.
-- ==================================================================

-- ------------------------------------------------------------------
-- 1. Profiles: stop exposing every user's email to every logged-in user.
--    Users can read only their own profile; email->id resolution for
--    sharing goes through a SECURITY DEFINER function that returns just
--    an id, so no address is ever enumerable.
-- ------------------------------------------------------------------

drop policy if exists "read profiles" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- Counterparties of an existing share still need each other's display info.
drop policy if exists "read profiles i share with" on public.profiles;
create policy "read profiles i share with" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.shares s
      where (s.owner_id = (select auth.uid()) and s.shared_with_user_id = profiles.id)
         or (s.shared_with_user_id = (select auth.uid()) and s.owner_id = profiles.id)
    )
  );

create or replace function public.lookup_user_by_email(lookup_email text)
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select id from public.profiles where lower(email) = lower(trim(lookup_email)) limit 1;
$$;

revoke all on function public.lookup_user_by_email(text) from public, anon;
grant execute on function public.lookup_user_by_email(text) to authenticated;

-- ------------------------------------------------------------------
-- 2. Notifications: a user may only notify someone they actually just
--    shared a file with. Previously any user could inject arbitrary
--    notification text into any other user's feed (phishing vector).
-- ------------------------------------------------------------------

drop policy if exists "insert notifications as actor" on public.notifications;
create policy "insert notifications as actor" on public.notifications
  for insert to authenticated
  with check (
    (select auth.uid()) = actor_id
    and exists (
      select 1 from public.shares s
      where s.file_id = notifications.file_id
        and s.owner_id = (select auth.uid())
        and s.shared_with_user_id = notifications.user_id
    )
  );

-- ------------------------------------------------------------------
-- 3. Realtime Authorization: without RLS on realtime.messages, ANY client
--    holding the public anon key can join `uploads:{uid}` / `presence:file:{id}`
--    and read filenames + viewer identities. These policies apply to
--    channels the client opens with `config: { private: true }`.
--
--    NOTE: `realtime.messages` already has RLS enabled by Supabase — the
--    SQL Editor's `postgres` role isn't the table owner and can't run
--    `alter table ... enable row level security` on it (and doesn't need
--    to). Only `create policy` is required, which Supabase does grant.
--    You must also flip "Realtime Authorization" on in the dashboard
--    (Settings → Realtime) for these policies to actually be enforced —
--    see README.
-- ------------------------------------------------------------------

-- Upload progress: only the owning user may read/write `uploads:{their-uid}`.
drop policy if exists "own upload channel" on realtime.messages;
create policy "own upload channel" on realtime.messages
  for all to authenticated
  using (realtime.topic() = 'uploads:' || (select auth.uid())::text)
  with check (realtime.topic() = 'uploads:' || (select auth.uid())::text);

-- Presence: only users who can actually see the file may join its channel.
drop policy if exists "presence on visible files" on realtime.messages;
create policy "presence on visible files" on realtime.messages
  for all to authenticated
  using (
    realtime.topic() like 'presence:file:%'
    and exists (
      select 1 from public.files f
      where f.id::text = replace(realtime.topic(), 'presence:file:', '')
        and f.deleted_at is null
        and (
          f.owner_id = (select auth.uid())
          or f.is_public = true
          or exists (
            select 1 from public.shares s
            where s.file_id = f.id and s.shared_with_user_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    realtime.topic() like 'presence:file:%'
    and exists (
      select 1 from public.files f
      where f.id::text = replace(realtime.topic(), 'presence:file:', '')
        and f.deleted_at is null
        and (
          f.owner_id = (select auth.uid())
          or f.is_public = true
          or exists (
            select 1 from public.shares s
            where s.file_id = f.id and s.shared_with_user_id = (select auth.uid())
          )
        )
    )
  );

-- ------------------------------------------------------------------
-- 4. True original size, so a compressed 34KB file doesn't display as 151B.
--    `size` stays the billed/stored byte count; `original_size` is what
--    the user actually uploaded.
-- ------------------------------------------------------------------

alter table public.files add column if not exists original_size bigint;
update public.files set original_size = size where original_size is null;

-- ------------------------------------------------------------------
-- 5. Search performance: ilike '%term%' can't use a b-tree index.
-- ------------------------------------------------------------------

create extension if not exists pg_trgm;
create index if not exists files_name_trgm_idx on public.files using gin (name gin_trgm_ops);

-- ------------------------------------------------------------------
-- 6. Storage stats as a single aggregate instead of streaming every row
--    to the app on every page load. Trashed bytes count toward quota
--    (they still occupy real storage), active bytes drive the category tiles.
-- ------------------------------------------------------------------

create or replace function public.get_storage_stats()
returns table (
  category text,
  file_count bigint,
  total_size bigint,
  trashed boolean
)
language sql
stable
security invoker
as $$
  select
    f.category,
    count(*)::bigint,
    coalesce(sum(f.size), 0)::bigint,
    (f.deleted_at is not null) as trashed
  from public.files f
  where f.owner_id = (select auth.uid())
  group by f.category, (f.deleted_at is not null);
$$;

grant execute on function public.get_storage_stats() to authenticated;

-- ------------------------------------------------------------------
-- 7. Scheduled trash purge. Previously the 30-day promise was only kept
--    if somebody happened to open the Trash page.
--    Note: deletes the DB rows; a Storage lifecycle job or the app's
--    lazy purge reclaims the objects.
-- ------------------------------------------------------------------

create or replace function public.purge_expired_trash()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from public.files
    where deleted_at is not null
      and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke all on function public.purge_expired_trash() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('nimbus-purge-trash')
      where exists (select 1 from cron.job where jobname = 'nimbus-purge-trash');
    perform cron.schedule('nimbus-purge-trash', '0 3 * * *', 'select public.purge_expired_trash()');
  end if;
end $$;

notify pgrst, 'reload schema';
