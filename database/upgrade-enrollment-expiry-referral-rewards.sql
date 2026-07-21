-- Adds course access expiry dates and referral reward coupon tracking.

alter table public.enrollments
add column if not exists expires_at timestamptz;

alter table public.referrals
add column if not exists reward_coupon_code text;

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
