-- MKV Academy upgrade: homepage welcome videos
-- Use this if your Supabase project already has the earlier MKV schema.

create table if not exists public.landing_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_bucket text not null default 'welcome-videos',
  video_path text,
  video_url text,
  poster_bucket text default 'welcome-videos',
  poster_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.landing_videos enable row level security;

drop policy if exists "Anyone can read active landing videos" on public.landing_videos;
create policy "Anyone can read active landing videos"
on public.landing_videos for select
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage landing videos" on public.landing_videos;
create policy "Admins manage landing videos"
on public.landing_videos for all
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('welcome-videos', 'welcome-videos', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins upload welcome videos" on storage.objects;
create policy "Admins upload welcome videos"
on storage.objects for insert
with check (bucket_id = 'welcome-videos' and public.is_admin());

drop policy if exists "Admins update welcome videos" on storage.objects;
create policy "Admins update welcome videos"
on storage.objects for update
using (bucket_id = 'welcome-videos' and public.is_admin())
with check (bucket_id = 'welcome-videos' and public.is_admin());

drop policy if exists "Admins delete welcome videos" on storage.objects;
create policy "Admins delete welcome videos"
on storage.objects for delete
using (bucket_id = 'welcome-videos' and public.is_admin());

drop policy if exists "Anyone can read welcome videos" on storage.objects;
create policy "Anyone can read welcome videos"
on storage.objects for select
using (bucket_id = 'welcome-videos');
