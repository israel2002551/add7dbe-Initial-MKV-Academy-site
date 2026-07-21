-- Public-safe syllabus reader for course preview pages.
-- Returns only chapter and lesson outline fields, not private video/storage paths.

create or replace function public.get_public_course_syllabus(p_course_id text)
returns table (
  chapter_title text,
  chapter_order integer,
  title text,
  description text,
  sort_order integer
)
language sql
security definer
set search_path = public
as $$
  select
    lessons.chapter_title,
    lessons.chapter_order,
    lessons.title,
    lessons.description,
    lessons.sort_order
  from public.lessons
  join public.courses on courses.id = lessons.course_id
  where lessons.course_id = p_course_id
    and courses.is_active = true
  order by lessons.chapter_order asc, lessons.sort_order asc, lessons.created_at asc;
$$;

grant execute on function public.get_public_course_syllabus(text) to anon, authenticated;
