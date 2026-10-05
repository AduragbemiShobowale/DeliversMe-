-- ---------------------------------------------------------------------------
-- Promote ONE existing account to administrator.
--
-- There is deliberately no way to become admin from the app: sign-up metadata
-- cannot choose 'admin', and admin_set_user_role() requires an existing admin.
--
-- 1. Sign up in the app with the email you want to use (and verify it).
-- 2. Replace the email below, then run this in Supabase Dashboard → SQL Editor
--    (it runs as the postgres role, which is the only way to bootstrap).
-- 3. Sign out and back in.
-- ---------------------------------------------------------------------------
do $$
declare
  v_email text := 'you@your-domain.com';   -- <-- change me
  v_count int;
begin
  update public.profiles
     set role = 'admin', onboarded = true, is_active = true
   where lower(email) = lower(v_email);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No profile with email %. Sign up first, then re-run.', v_email;
  end if;
  raise notice 'Promoted % to admin.', v_email;
end $$;
