-- 0007_triggers.sql
-- Shared trigger utilities: updated_at maintenance, and a defense-in-depth
-- check that deliveries.business_id always matches its
-- business_customers.business_id (the cross-table consistency noted as an
-- RPC responsibility in 0004's comment -- this trigger is the backstop in
-- case a future code path ever inserts/updates outside create_delivery).

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger trg_business_customers_updated_at
  before update on business_customers
  for each row execute function set_updated_at();

create trigger trg_deliveries_updated_at
  before update on deliveries
  for each row execute function set_updated_at();


create or replace function check_delivery_business_consistency()
returns trigger
language plpgsql
as $$
declare
  bc_business_id uuid;
begin
  select business_id into bc_business_id
  from business_customers
  where id = new.business_customer_id;

  if bc_business_id is null then
    raise exception 'business_customer_id % does not exist', new.business_customer_id;
  end if;

  if bc_business_id <> new.business_id then
    raise exception
      'deliveries.business_id (%) does not match business_customers.business_id (%) for business_customer_id %',
      new.business_id, bc_business_id, new.business_customer_id;
  end if;

  return new;
end;
$$;

create trigger trg_deliveries_business_consistency
  before insert or update of business_id, business_customer_id on deliveries
  for each row execute function check_delivery_business_consistency();

comment on function check_delivery_business_consistency() is
  'Defense-in-depth backstop for the denormalized deliveries.business_id column (see 0004). The create_delivery RPC (0013) is the primary enforcement path; this trigger guarantees the invariant even if a future code path bypasses that RPC.';
