-- Adds optional lecture resource downloads.

alter table public.lessons
add column if not exists resource_bucket text default 'course-materials',
add column if not exists resource_path text;

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

drop policy if exists "Enrolled students read course materials" on storage.objects;

create policy "Enrolled students read course materials"
on storage.objects for select
using (
  bucket_id = 'course-materials'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.lessons
      join public.enrollments on enrollments.course_id = lessons.course_id
      where lessons.resource_path = storage.objects.name
        and enrollments.user_id = auth.uid()
    )
  )
);
