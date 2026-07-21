-- MKV Academy Supabase starter schema
-- Run this in Supabase SQL Editor, then create private Storage buckets:
-- course-videos, course-assignments, course-materials.
-- Course thumbnails are public because they appear on the public catalog.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  email text,
  role text not null default 'student' check (role in ('student', 'instructor', 'admin', 'owner')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique_idx on public.profiles(username);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'username', 'student' || substr(replace(new.id::text, '-', ''), 1, 8)),
    new.email,
    case
      when lower(new.email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com') then 'admin'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles
set role = 'admin'
where lower(email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com');

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.courses (
  id text primary key,
  title text not null,
  description text,
  price numeric(12,2) not null default 0,
  currency text not null default 'NGN',
  level text not null default 'All Levels',
  thumbnail_path text,
  is_active boolean not null default true,
  drip_enabled boolean not null default false,
  certificate_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  chapter_title text not null default 'General',
  chapter_order integer not null default 1,
  description text,
  video_provider text not null default 'storage' check (video_provider in ('storage', 'bunny', 'cloudflare', 'mux', 'youtube', 'external')),
  video_bucket text default 'course-videos',
  video_path text,
  video_url text,
  stream_embed_url text,
  assignment_bucket text default 'course-assignments',
  assignment_path text,
  resource_bucket text default 'course-materials',
  resource_path text,
  sort_order integer not null default 0,
  unlock_after_days integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.lessons add column if not exists chapter_title text not null default 'General';
alter table public.lessons add column if not exists chapter_order integer not null default 1;
alter table public.lessons add column if not exists resource_bucket text default 'course-materials';
alter table public.lessons add column if not exists resource_path text;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  flutterwave_tx_ref text unique,
  flutterwave_transaction_id text,
  coupon_code text,
  discount_amount numeric(12,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.enrollments add column if not exists expires_at timestamptz;

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Student support',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_bucket text not null default 'assignment-submissions',
  file_path text not null,
  note text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_revision', 'approved')),
  grade text,
  feedback text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  note text,
  image_bucket text not null default 'project-review-submissions',
  image_path text not null,
  cad_bucket text not null default 'project-review-submissions',
  cad_path text not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_revision', 'approved')),
  feedback text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'contact',
  name text,
  email text not null,
  reason text,
  message text,
  notify_email text not null default 'mkvconsultingofficial@gmail.com',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text,
  action_url text,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table if not exists public.course_instructors (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, instructor_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  title text not null,
  pass_mark integer not null default 70,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0,
  passed boolean not null default false,
  submitted_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_email text,
  referred_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'signed_up', 'paid')),
  reward_status text not null default 'none' check (reward_status in ('none', 'pending', 'approved', 'paid')),
  reward_coupon_code text,
  created_at timestamptz not null default now()
);

alter table public.referrals add column if not exists reward_coupon_code text;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'percent' check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null default 0,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'flutterwave',
  event_type text,
  tx_ref text,
  transaction_id text,
  status text not null default 'received',
  payload jsonb,
  verified_payload jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.orders enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.project_review_submissions enable row level security;
alter table public.lead_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.landing_videos enable row level security;
alter table public.course_instructors enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.referrals enable row level security;
alter table public.coupons enable row level security;
alter table public.payment_events enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  );
$$;

create or replace function public.is_instructor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin', 'owner')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin', 'owner')
  );
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

  insert into public.enrollments (user_id, course_id, order_id)
  values (p_user_id, p_course_id, v_order_id)
  on conflict (user_id, course_id)
  do update set order_id = excluded.order_id;

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

create or replace function public.issue_certificate_if_complete(p_user_id uuid, p_course_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_done integer;
  v_certificate_id uuid;
begin
  if p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Certificate access denied';
  end if;

  select count(*) into v_total
  from public.lessons
  where course_id = p_course_id;

  select count(*) into v_done
  from public.lessons
  join public.lesson_progress on lesson_progress.lesson_id = lessons.id
  where lessons.course_id = p_course_id
    and lesson_progress.user_id = p_user_id
    and lesson_progress.completed = true;

  if v_total = 0 or v_done < v_total then
    return null;
  end if;

  insert into public.certificates (user_id, course_id, certificate_code)
  values (p_user_id, p_course_id, upper(substr(md5(p_user_id::text || p_course_id || now()::text), 1, 12)))
  on conflict (user_id, course_id) do update set issued_at = public.certificates.issued_at
  returning id into v_certificate_id;

  return v_certificate_id;
end;
$$;

create or replace function public.increment_coupon_redemption(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
  set redeemed_count = redeemed_count + 1
  where code = upper(p_code);
$$;

create or replace function public.get_quiz_payload(p_quiz_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'pass_mark', q.pass_mark,
    'questions', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', qq.id,
        'question', qq.question,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', qo.id, 'option_text', qo.option_text) order by qo.sort_order), '[]'::jsonb)
          from public.quiz_options qo
          where qo.question_id = qq.id
        )
      ) order by qq.sort_order
    ) filter (where qq.id is not null), '[]'::jsonb)
  )
  from public.quizzes q
  left join public.quiz_questions qq on qq.quiz_id = q.id
  where q.id = p_quiz_id
    and (
      public.is_instructor()
      or exists (
        select 1 from public.enrollments
        where enrollments.user_id = auth.uid()
          and enrollments.course_id = q.course_id
      )
    )
  group by q.id;
$$;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_correct integer;
  v_score integer;
  v_pass_mark integer;
  v_passed boolean;
begin
  select count(*) into v_total
  from public.quiz_questions
  where quiz_id = p_quiz_id;

  select count(*) into v_correct
  from jsonb_each_text(p_answers) ans(question_id, option_id)
  join public.quiz_options qo on qo.id::text = ans.option_id
  join public.quiz_questions qq on qq.id = qo.question_id
  where qq.quiz_id = p_quiz_id
    and qq.id::text = ans.question_id
    and qo.is_correct = true;

  select pass_mark into v_pass_mark from public.quizzes where id = p_quiz_id;
  v_score := case when v_total = 0 then 0 else round((v_correct::numeric / v_total::numeric) * 100) end;
  v_passed := v_score >= coalesce(v_pass_mark, 70);

  insert into public.quiz_attempts (quiz_id, user_id, score, passed)
  values (p_quiz_id, auth.uid(), v_score, v_passed);

  return jsonb_build_object('score', v_score, 'passed', v_passed, 'correct', v_correct, 'total', v_total);
end;
$$;

drop policy if exists "Students can read own profile" on public.profiles;
drop policy if exists "Students can insert own profile" on public.profiles;
drop policy if exists "Students can update own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Anyone can read active courses" on public.courses;
drop policy if exists "Admins manage courses" on public.courses;
drop policy if exists "Instructors read assigned courses" on public.course_instructors;
drop policy if exists "Admins manage instructor assignments" on public.course_instructors;
drop policy if exists "Enrolled students read lessons" on public.lessons;
drop policy if exists "Admins manage lessons" on public.lessons;
drop policy if exists "Assigned instructors manage lessons" on public.lessons;
drop policy if exists "Students read own orders" on public.orders;
drop policy if exists "Admins manage orders" on public.orders;
drop policy if exists "Students read own enrollments" on public.enrollments;
drop policy if exists "Admins manage enrollments" on public.enrollments;
drop policy if exists "Students manage own progress" on public.lesson_progress;
drop policy if exists "Students read own chat threads" on public.chat_threads;
drop policy if exists "Students create own chat threads" on public.chat_threads;
drop policy if exists "Admins create chat threads" on public.chat_threads;
drop policy if exists "Students update own chat threads" on public.chat_threads;
drop policy if exists "Admins update chat threads" on public.chat_threads;
drop policy if exists "Chat participants read messages" on public.chat_messages;
drop policy if exists "Chat participants send messages" on public.chat_messages;
drop policy if exists "Students read own submissions" on public.assignment_submissions;
drop policy if exists "Students submit own assignments" on public.assignment_submissions;
drop policy if exists "Admins review submissions" on public.assignment_submissions;
drop policy if exists "Staff delete submissions" on public.assignment_submissions;
drop policy if exists "Students read own project reviews" on public.project_review_submissions;
drop policy if exists "Students submit own project reviews" on public.project_review_submissions;
drop policy if exists "Staff review project submissions" on public.project_review_submissions;
drop policy if exists "Staff delete project submissions" on public.project_review_submissions;
drop policy if exists "Anyone can submit leads" on public.lead_submissions;
drop policy if exists "Admins read leads" on public.lead_submissions;
drop policy if exists "Students read own notifications" on public.notifications;
drop policy if exists "Students mark own notifications" on public.notifications;
drop policy if exists "Admins manage notifications" on public.notifications;
drop policy if exists "Students manage own referrals" on public.referrals;
drop policy if exists "Anyone can read active coupons" on public.coupons;
drop policy if exists "Admins manage coupons" on public.coupons;
drop policy if exists "Admins read payment events" on public.payment_events;
drop policy if exists "Enrolled students read quizzes" on public.quizzes;
drop policy if exists "Instructors manage quizzes" on public.quizzes;
drop policy if exists "Students read quiz questions" on public.quiz_questions;
drop policy if exists "Instructors manage quiz questions" on public.quiz_questions;
drop policy if exists "Instructors read quiz options" on public.quiz_options;
drop policy if exists "Instructors manage quiz options" on public.quiz_options;
drop policy if exists "Students read own quiz attempts" on public.quiz_attempts;
drop policy if exists "Students create own quiz attempts" on public.quiz_attempts;
drop policy if exists "Students read own certificates" on public.certificates;
drop policy if exists "Admins manage certificates" on public.certificates;
drop policy if exists "Anyone can read active landing videos" on public.landing_videos;
drop policy if exists "Admins manage landing videos" on public.landing_videos;

create policy "Students can read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Students can insert own profile"
on public.profiles for insert
with check (id = auth.uid() and role = 'student');

create policy "Students can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'student');

create policy "Admins manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Anyone can read active courses"
on public.courses for select
using (is_active = true or public.is_admin());

create policy "Admins manage courses"
on public.courses for all
using (public.is_admin())
with check (public.is_admin());

create policy "Instructors read assigned courses"
on public.course_instructors for select
using (instructor_id = auth.uid() or public.is_admin());

create policy "Admins manage instructor assignments"
on public.course_instructors for all
using (public.is_admin())
with check (public.is_admin());

create policy "Enrolled students read lessons"
on public.lessons for select
using (
  public.is_admin()
  or exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = lessons.course_id
  )
);

create policy "Admins manage lessons"
on public.lessons for all
using (public.is_admin())
with check (public.is_admin());

create policy "Assigned instructors manage lessons"
on public.lessons for all
using (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = lessons.course_id
      and course_instructors.instructor_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors
    where course_instructors.course_id = lessons.course_id
      and course_instructors.instructor_id = auth.uid()
  )
);

create policy "Students read own orders"
on public.orders for select
using (user_id = auth.uid() or public.is_admin());

create policy "Admins manage orders"
on public.orders for all
using (public.is_admin())
with check (public.is_admin());

create policy "Students read own enrollments"
on public.enrollments for select
using (user_id = auth.uid() or public.is_admin());

create policy "Admins manage enrollments"
on public.enrollments for all
using (public.is_admin())
with check (public.is_admin());

create policy "Students manage own progress"
on public.lesson_progress for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Students read own chat threads"
on public.chat_threads for select
using (student_id = auth.uid() or public.is_staff());

create policy "Students create own chat threads"
on public.chat_threads for insert
with check (student_id = auth.uid());

create policy "Admins create chat threads"
on public.chat_threads for insert
with check (public.is_staff());

create policy "Students update own chat threads"
on public.chat_threads for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "Admins update chat threads"
on public.chat_threads for update
using (public.is_staff())
with check (public.is_staff());

create policy "Chat participants read messages"
on public.chat_messages for select
using (
  public.is_staff()
  or exists (
    select 1 from public.chat_threads
    where chat_threads.id = chat_messages.thread_id
      and chat_threads.student_id = auth.uid()
  )
);

create policy "Chat participants send messages"
on public.chat_messages for insert
with check (
  sender_id = auth.uid()
  and (
    public.is_staff()
    or exists (
      select 1 from public.chat_threads
      where chat_threads.id = chat_messages.thread_id
        and chat_threads.student_id = auth.uid()
    )
  )
);

create policy "Students read own submissions"
on public.assignment_submissions for select
using (user_id = auth.uid() or public.is_staff());

create policy "Students submit own assignments"
on public.assignment_submissions for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = assignment_submissions.course_id
  )
);

create policy "Admins review submissions"
on public.assignment_submissions for update
using (public.is_staff())
with check (public.is_staff());

create policy "Staff delete submissions"
on public.assignment_submissions for delete
using (public.is_staff());

create policy "Students read own project reviews"
on public.project_review_submissions for select
using (user_id = auth.uid() or public.is_staff());

create policy "Students submit own project reviews"
on public.project_review_submissions for insert
with check (user_id = auth.uid());

create policy "Staff review project submissions"
on public.project_review_submissions for update
using (public.is_staff())
with check (public.is_staff());

create policy "Staff delete project submissions"
on public.project_review_submissions for delete
using (public.is_staff());

create policy "Anyone can submit leads"
on public.lead_submissions for insert
with check (true);

create policy "Admins read leads"
on public.lead_submissions for select
using (public.is_admin());

create policy "Students read own notifications"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

create policy "Students mark own notifications"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins manage notifications"
on public.notifications for all
using (public.is_admin())
with check (public.is_admin());

create policy "Students manage own referrals"
on public.referrals for all
using (referrer_id = auth.uid() or public.is_admin())
with check (referrer_id = auth.uid() or public.is_admin());

create policy "Anyone can read active coupons"
on public.coupons for select
using (is_active = true or public.is_admin());

create policy "Admins manage coupons"
on public.coupons for all
using (public.is_admin())
with check (public.is_admin());

create policy "Admins read payment events"
on public.payment_events for select
using (public.is_admin());

create policy "Enrolled students read quizzes"
on public.quizzes for select
using (
  is_active = true
  and exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid()
      and enrollments.course_id = quizzes.course_id
  )
  or public.is_instructor()
);

create policy "Instructors manage quizzes"
on public.quizzes for all
using (public.is_instructor())
with check (public.is_instructor());

create policy "Students read quiz questions"
on public.quiz_questions for select
using (
  exists (
    select 1 from public.quizzes
    join public.enrollments on enrollments.course_id = quizzes.course_id
    where quizzes.id = quiz_questions.quiz_id
      and enrollments.user_id = auth.uid()
  )
  or public.is_instructor()
);

create policy "Instructors manage quiz questions"
on public.quiz_questions for all
using (public.is_instructor())
with check (public.is_instructor());

create policy "Instructors read quiz options"
on public.quiz_options for select
using (public.is_instructor());

create policy "Instructors manage quiz options"
on public.quiz_options for all
using (public.is_instructor())
with check (public.is_instructor());

create policy "Students read own quiz attempts"
on public.quiz_attempts for select
using (user_id = auth.uid() or public.is_instructor());

create policy "Students create own quiz attempts"
on public.quiz_attempts for insert
with check (user_id = auth.uid());

create policy "Students read own certificates"
on public.certificates for select
using (user_id = auth.uid() or public.is_admin());

create policy "Admins manage certificates"
on public.certificates for all
using (public.is_admin())
with check (public.is_admin());

create policy "Anyone can read active landing videos"
on public.landing_videos for select
using (is_active = true or public.is_admin());

create policy "Admins manage landing videos"
on public.landing_videos for all
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values
  ('course-videos', 'course-videos', false),
  ('course-assignments', 'course-assignments', false),
  ('course-materials', 'course-materials', false),
  ('course-thumbnails', 'course-thumbnails', true),
  ('assignment-submissions', 'assignment-submissions', false),
  ('project-review-submissions', 'project-review-submissions', false),
  ('welcome-videos', 'welcome-videos', true)
on conflict (id) do nothing;

drop policy if exists "Admins upload course videos" on storage.objects;
drop policy if exists "Admins update course files" on storage.objects;
drop policy if exists "Admins delete course files" on storage.objects;
drop policy if exists "Admins upload welcome videos" on storage.objects;
drop policy if exists "Admins update welcome videos" on storage.objects;
drop policy if exists "Admins delete welcome videos" on storage.objects;
drop policy if exists "Anyone can read welcome videos" on storage.objects;
drop policy if exists "Anyone can read course thumbnails" on storage.objects;
drop policy if exists "Students upload own submissions" on storage.objects;
drop policy if exists "Students read own submissions files" on storage.objects;
drop policy if exists "Enrolled students read paid videos" on storage.objects;
drop policy if exists "Enrolled students read paid assignments" on storage.objects;
drop policy if exists "Enrolled students read course materials" on storage.objects;

create policy "Admins upload course videos"
on storage.objects for insert
with check (bucket_id in ('course-videos', 'course-assignments', 'course-materials', 'assignment-submissions', 'course-thumbnails') and public.is_admin());

create policy "Admins update course files"
on storage.objects for update
using (bucket_id in ('course-videos', 'course-assignments', 'course-materials', 'assignment-submissions', 'course-thumbnails') and public.is_admin())
with check (bucket_id in ('course-videos', 'course-assignments', 'course-materials', 'assignment-submissions', 'course-thumbnails') and public.is_admin());

create policy "Admins delete course files"
on storage.objects for delete
using (bucket_id in ('course-videos', 'course-assignments', 'course-materials', 'assignment-submissions', 'course-thumbnails') and public.is_admin());

create policy "Admins upload welcome videos"
on storage.objects for insert
with check (bucket_id = 'welcome-videos' and public.is_admin());

create policy "Admins update welcome videos"
on storage.objects for update
using (bucket_id = 'welcome-videos' and public.is_admin())
with check (bucket_id = 'welcome-videos' and public.is_admin());

create policy "Admins delete welcome videos"
on storage.objects for delete
using (bucket_id = 'welcome-videos' and public.is_admin());

create policy "Anyone can read welcome videos"
on storage.objects for select
using (bucket_id = 'welcome-videos');

create policy "Anyone can read course thumbnails"
on storage.objects for select
using (bucket_id = 'course-thumbnails');

create policy "Students upload own submissions"
on storage.objects for insert
with check (
  bucket_id in ('assignment-submissions', 'project-review-submissions')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Students read own submissions files"
on storage.objects for select
using (
  bucket_id in ('assignment-submissions', 'project-review-submissions')
  and (
    public.is_staff()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

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
    )
  )
);

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
    )
  )
);

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
