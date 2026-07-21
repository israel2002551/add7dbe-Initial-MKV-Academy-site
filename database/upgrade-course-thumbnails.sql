-- Adds public course thumbnail uploads for the admin course form.

alter table public.courses
add column if not exists thumbnail_path text;

insert into storage.buckets (id, name, public)
values ('course-thumbnails', 'course-thumbnails', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins upload course thumbnails" on storage.objects;
drop policy if exists "Admins update course thumbnails" on storage.objects;
drop policy if exists "Admins delete course thumbnails" on storage.objects;
drop policy if exists "Anyone can read course thumbnails" on storage.objects;

create policy "Admins upload course thumbnails"
on storage.objects for insert
with check (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "Admins update course thumbnails"
on storage.objects for update
using (bucket_id = 'course-thumbnails' and public.is_admin())
with check (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "Admins delete course thumbnails"
on storage.objects for delete
using (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "Anyone can read course thumbnails"
on storage.objects for select
using (bucket_id = 'course-thumbnails');
