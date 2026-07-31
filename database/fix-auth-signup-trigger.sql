-- Fix Auth signup 500s caused by the public.profiles creation trigger.
-- Run this in Supabase SQL Editor, then try creating a new account again.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_role text;
begin
  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'student' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

  v_role := case
    when lower(new.email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com') then 'admin'
    else 'student'
  end;

  insert into public.profiles (id, full_name, username, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    v_username,
    new.email,
    v_role
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    username = coalesce(public.profiles.username, excluded.username),
    role = case
      when lower(excluded.email) in ('israelefe093@gmail.com', 'josephcelestinediamond@gmail.com') then 'admin'
      else public.profiles.role
    end;

  return new;
exception
  when unique_violation then
    raise warning 'Could not create profile for auth user %, duplicate profile value: %', new.id, sqlerrm;
    return new;
  when others then
    raise warning 'Could not create profile for auth user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
