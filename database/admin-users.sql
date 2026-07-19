-- MKV Academy admin users
-- Run this after the listed users have created accounts on the site.

update public.profiles
set role = 'admin'
where lower(email) in (
  'israelefe093@gmail.com',
  'josephcelestinediamond@gmail.com'
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    case
      when lower(new.email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com') then 'admin'
      else 'student'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = case
          when lower(excluded.email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com') then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;
