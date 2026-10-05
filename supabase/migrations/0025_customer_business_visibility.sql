-- 0025_customer_business_visibility.sql
-- Real gap found while wiring the customer's "My Deliveries" view: 0009's
-- businesses RLS only granted SELECT to the owning Owner and to Admin.
-- A customer with an active relationship to a business has no way to see
-- even that business's name -- which breaks the very view Phase 2's
-- customer role was introduced to support.
--
-- Scoped narrowly: only businesses the customer has an ACTIVE
-- relationship with (not pending -- nothing to see yet if they haven't
-- been claimed), and via a join through business_customers, which is
-- itself already correctly scoped (0010). Does not expose businesses the
-- customer has no relationship with at all.

create policy businesses_select_customer on businesses
  for select
  using (
    current_profile_role() = 'customer'
    and id in (
      select business_id from business_customers
      where customer_profile_id = auth.uid() and status = 'active'
    )
  );
