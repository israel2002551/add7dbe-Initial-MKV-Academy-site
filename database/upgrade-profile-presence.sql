-- Adds profile avatars and online presence fields.
-- Run in Supabase SQL Editor.

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_online boolean not null default false;
alter table public.profiles add column if not exists last_active_at timestamptz;

create unique index if not exists profiles_username_unique_idx on public.profiles(username);
create index if not exists profiles_last_active_idx on public.profiles(last_active_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read public profile identity" on public.profiles;
create policy "Authenticated users read public profile identity"
on public.profiles for select
using (auth.uid() is not null);

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Anyone reads avatars" on storage.objects;
create policy "Anyone reads avatars"
on storage.objects for select
using (bucket_id = 'avatars');
