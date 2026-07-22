-- Enforces course expiry everywhere an enrollment grants access.
-- Run this on existing Supabase projects after adding enrollments.expires_at.

alter table public.enrollments
add column if not exists expires_at timestamptz;

create or replace function public.revoke_expired_enrollments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.enrollments
  where expires_at is not null
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.grant_paid_course_access(
  p_user_id uuid,
  p_course_id text,
  p_amount numeric,
  p_currency text,
  p_tx_ref text,
  p_transaction_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_coupon_code text;
begin
  insert into public.orders (
    user_id,
    course_id,
    amount,
    currency,
    status,
    flutterwave_tx_ref,
    flutterwave_transaction_id,
    paid_at
  )
  values (
    p_user_id,
    p_course_id,
    p_amount,
    coalesce(p_currency, 'NGN'),
    'paid',
    p_tx_ref,
    p_transaction_id,
    now()
  )
  on conflict (flutterwave_tx_ref)
  do update set
    status = 'paid',
    flutterwave_transaction_id = excluded.flutterwave_transaction_id,
    paid_at = coalesce(public.orders.paid_at, now())
  returning id, coupon_code into v_order_id, v_coupon_code;

  if v_coupon_code is not null then
    perform public.increment_coupon_redemption(v_coupon_code);
  end if;

  insert into public.enrollments (user_id, course_id, order_id, expires_at)
  values (p_user_id, p_course_id, v_order_id, null)
  on conflict (user_id, course_id)
  do update set
    order_id = excluded.order_id,
    expires_at = null;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    p_user_id,
    'enrollment',
    'Course access unlocked',
    'Your payment has been confirmed and your course is now available.',
    'students.html'
  );

  return v_order_id;
end;
$$;

drop policy if exists "Enrolled students read lessons" on public.lessons;
create policy "Enrolled students read lessons"
on public.lessons for select
using (
  public.is_admin()
  or exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = lessons.course_id
      and (enrollments.expires_at is null or enrollments.expires_at > now())
  )
);

drop policy if exists "Students submit own assignments" on public.assignment_submissions;
create policy "Students submit own assignments"
on public.assignment_submissions for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = assignment_submissions.course_id
      and (enrollments.expires_at is null or enrollments.expires_at > now())
  )
);

drop policy if exists "Enrolled students read quizzes" on public.quizzes;
create policy "Enrolled students read quizzes"
on public.quizzes for select
using (
  (
    is_active = true
    and exists (
      select 1 from public.enrollments
      where enrollments.user_id = auth.uid()
        and enrollments.course_id = quizzes.course_id
        and (enrollments.expires_at is null or enrollments.expires_at > now())
    )
  )
  or public.is_instructor()
);

drop policy if exists "Students read quiz questions" on public.quiz_questions;
create policy "Students read quiz questions"
on public.quiz_questions for select
using (
  exists (
    select 1 from public.quizzes
    join public.enrollments on enrollments.course_id = quizzes.course_id
    where quizzes.id = quiz_questions.quiz_id
      and enrollments.user_id = auth.uid()
      and (enrollments.expires_at is null or enrollments.expires_at > now())
  )
  or public.is_instructor()
);

drop policy if exists "Enrolled students read paid videos" on storage.objects;
create policy "Enrolled students read paid videos"
on storage.objects for select
using (
  bucket_id = 'course-videos'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.lessons
      join public.enrollments on enrollments.course_id = lessons.course_id
      where lessons.video_path = storage.objects.name
        and enrollments.user_id = auth.uid()
        and (enrollments.expires_at is null or enrollments.expires_at > now())
    )
  )
);

drop policy if exists "Enrolled students read paid assignments" on storage.objects;
create policy "Enrolled students read paid assignments"
on storage.objects for select
using (
  bucket_id = 'course-assignments'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.lessons
      join public.enrollments on enrollments.course_id = lessons.course_id
      where lessons.assignment_path = storage.objects.name
        and enrollments.user_id = auth.uid()
        and (enrollments.expires_at is null or enrollments.expires_at > now())
    )
  )
);

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
        and (enrollments.expires_at is null or enrollments.expires_at > now())
    )
  )
);
