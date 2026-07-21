-- Allows instructors/admins to show student names on assignment review rows.

drop policy if exists "Staff can read profiles" on public.profiles;
create policy "Staff can read profiles"
on public.profiles for select
using (public.is_staff());
