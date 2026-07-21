-- Routes assignment review access to admins and course-assigned instructors only.

drop policy if exists "Students read own submissions" on public.assignment_submissions;
create policy "Students read own submissions"
on public.assignment_submissions for select
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = assignment_submissions.course_id
      and course_instructors.instructor_id = auth.uid()
  )
);

drop policy if exists "Admins review submissions" on public.assignment_submissions;
create policy "Admins review submissions"
on public.assignment_submissions for update
using (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = assignment_submissions.course_id
      and course_instructors.instructor_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = assignment_submissions.course_id
      and course_instructors.instructor_id = auth.uid()
  )
);

drop policy if exists "Staff delete submissions" on public.assignment_submissions;
create policy "Staff delete submissions"
on public.assignment_submissions for delete
using (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = assignment_submissions.course_id
      and course_instructors.instructor_id = auth.uid()
  )
);
