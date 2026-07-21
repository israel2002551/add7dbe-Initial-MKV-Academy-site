-- Adds course complexity/level editing and lets staff delete review submissions.

alter table public.courses
add column if not exists level text not null default 'All Levels';

drop policy if exists "Staff delete submissions" on public.assignment_submissions;
create policy "Staff delete submissions"
on public.assignment_submissions for delete
using (public.is_staff());

drop policy if exists "Staff delete project submissions" on public.project_review_submissions;
create policy "Staff delete project submissions"
on public.project_review_submissions for delete
using (public.is_staff());
