-- MKV Academy upgrade: instructor dashboard, quizzes, certificates,
-- referrals, coupons, analytics/payment events, drip content.
-- Run this if you already applied the earlier schema.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
check (role in ('student', 'instructor', 'admin', 'owner'));

alter table public.courses add column if not exists drip_enabled boolean not null default false;
alter table public.courses add column if not exists certificate_enabled boolean not null default true;
alter table public.lessons add column if not exists unlock_after_days integer not null default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;

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
  status text not null default 'pending',
  reward_status text not null default 'none',
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'percent',
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

alter table public.course_instructors enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.referrals enable row level security;
alter table public.coupons enable row level security;
alter table public.payment_events enable row level security;

create or replace function public.is_instructor()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin', 'owner')
  );
$$;

create or replace function public.increment_coupon_redemption(p_code text)
returns void language sql security definer set search_path = public as $$
  update public.coupons set redeemed_count = redeemed_count + 1 where code = upper(p_code);
$$;

create or replace function public.get_quiz_payload(p_quiz_id uuid)
returns jsonb language sql security definer set search_path = public as $$
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
  group by q.id;
$$;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  v_correct integer;
  v_score integer;
  v_pass_mark integer;
  v_passed boolean;
begin
  if not exists (
    select 1 from public.quizzes
    join public.enrollments on enrollments.course_id = quizzes.course_id
    where quizzes.id = p_quiz_id
      and enrollments.user_id = auth.uid()
  ) then
    raise exception 'Quiz access denied';
  end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = p_quiz_id;
  select count(*) into v_correct
  from jsonb_each_text(p_answers) ans(question_id, option_id)
  join public.quiz_options qo on qo.id::text = ans.option_id
  join public.quiz_questions qq on qq.id = qo.question_id
  where qq.quiz_id = p_quiz_id and qq.id::text = ans.question_id and qo.is_correct = true;
  select pass_mark into v_pass_mark from public.quizzes where id = p_quiz_id;
  v_score := case when v_total = 0 then 0 else round((v_correct::numeric / v_total::numeric) * 100) end;
  v_passed := v_score >= coalesce(v_pass_mark, 70);
  insert into public.quiz_attempts (quiz_id, user_id, score, passed)
  values (p_quiz_id, auth.uid(), v_score, v_passed);
  return jsonb_build_object('score', v_score, 'passed', v_passed, 'correct', v_correct, 'total', v_total);
end;
$$;
