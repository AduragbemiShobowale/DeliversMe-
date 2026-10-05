-- 0022_fix_signup_trigger_missing_metadata.sql
-- Real bug found during Phase 2 manual testing: the original
-- handle_new_user() trigger (0018) raised an exception whenever a new
-- auth.users row had no role in its metadata -- which blocks ANY
-- account created through a dashboard flow that doesn't expose a
-- metadata field (some Supabase dashboard versions' simple "Add user"
-- form don't). This also would have blocked ever manually seeding an
-- Admin account through that same simple form, which was always the
-- intended provisioning path for Admin (Phase 2 §6/§16).
--
-- Fix: missing/unrecognized role metadata is now a silent no-op, not a
-- hard failure. The auth.users row is created successfully; whoever is
-- provisioning that account (a developer via SQL, or a future admin
-- console) inserts the matching profiles row separately, same pattern
-- already used for riders.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
  v_business_name text;
  v_new_business_id uuid;
begin
  v_role := new.raw_user_meta_data ->> 'role';

  if v_role = 'owner' then
    v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed');
    v_business_name := new.raw_user_meta_data ->> 'business_name';
    if v_business_name is null or char_length(trim(v_business_name)) = 0 then
      raise exception 'business_name is required for owner signup';
    end if;

    v_new_business_id := gen_random_uuid();
    insert into businesses (id, owner_profile_id, name)
    values (v_new_business_id, new.id, v_business_name);

    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'owner', v_new_business_id, v_full_name, new.raw_user_meta_data ->> 'phone');

  elsif v_role = 'customer' then
    v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed');
    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'customer', null, v_full_name, new.raw_user_meta_data ->> 'phone');

  else
    -- No metadata, unrecognized role, or role='rider' (always
    -- provisioned separately -- see 0018's original comment). This is
    -- now a silent no-op rather than an exception: the auth.users row
    -- is created either way, and whoever needs a profiles row for it
    -- (a developer via SQL now, an Edge Function or admin console
    -- later) creates it as a separate, explicit step.
    return new;
  end if;

  return new;
end;
$$;
