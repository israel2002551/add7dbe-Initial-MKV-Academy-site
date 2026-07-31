-- MKV Academy upgrade: YouTube Unlisted lesson playback MVP.
-- Run in Supabase SQL Editor after deploying the frontend changes.

alter table public.lessons
drop constraint if exists lessons_youtube_video_id_check;

alter table public.lessons
add constraint lessons_youtube_video_id_check
check (
  video_provider <> 'youtube'
  or coalesce(stream_embed_url, video_url, '') = ''
  or coalesce(stream_embed_url, video_url, '') ~ '^[A-Za-z0-9_-]{11}$'
) not valid;

create table if not exists public.lesson_video_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  video_provider text not null,
  video_id text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.lesson_video_access_logs enable row level security;

drop policy if exists "Admins read lesson video access logs" on public.lesson_video_access_logs;
create policy "Admins read lesson video access logs"
on public.lesson_video_access_logs for select
using (public.is_admin());

create or replace function public.get_lesson_video_source(p_lesson_id uuid)
returns table(provider text, video_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson public.lessons%rowtype;
  v_video_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found';
  end if;

  if not exists (
    select 1
    from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = v_lesson.course_id
      and (enrollments.expires_at is null or enrollments.expires_at > now())
  ) and not public.is_admin() then
    raise exception 'You are not enrolled in this course';
  end if;

  if v_lesson.video_provider <> 'youtube' then
    raise exception 'This lesson is not a YouTube lesson';
  end if;

  v_video_id := coalesce(nullif(v_lesson.stream_embed_url, ''), nullif(v_lesson.video_url, ''));

  if v_video_id is null or v_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Lesson video is not configured';
  end if;

  insert into public.lesson_video_access_logs (user_id, lesson_id, course_id, video_provider, video_id, user_agent)
  values (
    auth.uid(),
    v_lesson.id,
    v_lesson.course_id,
    v_lesson.video_provider,
    v_video_id,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'user-agent'
  );

  provider := v_lesson.video_provider;
  video_id := v_video_id;
  return next;
end;
$$;

grant execute on function public.get_lesson_video_source(uuid) to authenticated;
