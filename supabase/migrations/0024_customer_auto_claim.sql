-- 0024_customer_auto_claim.sql
-- Real gap found during the continuous build pass: nothing specified how
-- a customer discovers which business_customer_id to claim (riders get
-- an emailed link with an implicit token; customers, as specified, do
-- not). claim_business_customer (0014) requires an id the customer has
-- no RLS-permitted way to look up.
--
-- Resolution: auto-claim by phone match, in one RPC, called once right
-- after a customer signs in. Matches Phase 2 §3's own framing ("when the
-- customer subsequently registers... the relationship becomes visible")
-- more directly than a manual per-relationship claim flow would.

create or replace function claim_pending_relationships_by_phone()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_claimed_count int;
begin
  if current_profile_role() <> 'customer' then
    raise exception 'Only a customer account may claim pending relationships';
  end if;

  select phone into v_phone from profiles where id = auth.uid();
  if v_phone is null then
    return 0; -- no phone on file, nothing to match against
  end if;

  with claimed as (
    update business_customers
    set customer_profile_id = auth.uid(), status = 'active'
    where status = 'pending_invitation' and pending_phone = v_phone
    returning id
  )
  select count(*) into v_claimed_count from claimed;

  return v_claimed_count;
end;
$$;

comment on function claim_pending_relationships_by_phone is
  'Superseded, simpler alternative to claim_business_customer (0014) for the common case -- claims every pending relationship matching the caller''s own phone in one pass, rather than requiring a per-relationship id the customer has no way to discover. claim_business_customer is left in place for a future explicit-link-based flow if one is ever added.';

grant execute on function claim_pending_relationships_by_phone to authenticated;
