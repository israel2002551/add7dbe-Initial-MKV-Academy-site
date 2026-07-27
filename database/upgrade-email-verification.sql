-- Supports the email verification registration flow.
-- Also enable this in Supabase Dashboard:
-- Authentication > Providers > Email > Confirm email = ON
-- Authentication > URL Configuration > Site URL = your production site URL
-- Authentication > Email Templates > Confirm signup = expiry around 24 hours

create unique index if not exists profiles_email_unique_idx
on public.profiles(lower(email))
where email is not null;
