-- 0018_auth_signup_provisioning.sql
-- Owner and Customer both self-register via supabase.auth.signUp() with
-- role encoded in user_metadata (client passes { data: { role, full_name,
-- business_name? } }). This trigger provisions the matching profiles (and,
-- for Owner, businesses) row atomically with the auth.users insert.
--
-- Rider provisioning is DELIBERATELY NOT handled here. A rider's
-- auth.users row is created server-side by the Owner-invite Edge Function
-- using the Supabase service role (supabase.auth.admin.inviteUserByEmail),
-- which then inserts the profiles row itself with role='rider' and the
-- inviting Owner's business_id -- a client-driven signUp() call can never
-- self-assign the rider role, which is the structural enforcement of
-- "riders do not self-register" (Stage 6, reaffirmed throughout).
-- Admin provisioning is never trigger-driven at all -- seeded directly.

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
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed');

  if v_role = 'owner' then
    v_business_name := new.raw_user_meta_data ->> 'business_name';
    if v_business_name is null or char_length(trim(v_business_name)) = 0 then
      raise exception 'business_name is required for owner signup';
    end if;

    v_new_business_id := gen_random_uuid();

    -- Relies on businesses_owner_profile_fk being DEFERRABLE INITIALLY
    -- DEFERRED (0002) to resolve the businesses<->profiles circularity --
    -- see that migration's comment for the full explanation.
    insert into businesses (id, owner_profile_id, name)
    values (v_new_business_id, new.id, v_business_name);

    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'owner', v_new_business_id, v_full_name, new.raw_user_meta_data ->> 'phone');

  elsif v_role = 'customer' then
    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'customer', null, v_full_name, new.raw_user_meta_data ->> 'phone');

  elsif v_role = 'rider' then
    -- No-op by design -- see comment above. Silently skipping (rather
    -- than raising) allows the invite Edge Function's own profiles
    -- INSERT to proceed without a race against this trigger.
    return new;

  else
    raise exception 'Unrecognized or missing role in signup metadata: %', v_role;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
