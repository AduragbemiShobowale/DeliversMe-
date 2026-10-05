-- 0004_deliveries.sql
-- Phase 2 §13: deliveries, referencing business_customers rather than a
-- bare customer id. business_id is deliberately stored redundantly here
-- (denormalized against business_customers.business_id) -- every RLS
-- policy and dashboard query filters on it directly, and it never changes
-- after creation. See the Phase 2 report for why this trade-off was made
-- explicitly rather than left implicit.

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  business_customer_id uuid not null references business_customers (id) on delete restrict,
  assigned_rider_id uuid references riders (profile_id) on delete set null,

  status delivery_status not null default 'ready_for_dispatch',
  priority delivery_priority not null default 'normal',
  scheduled_window_start timestamptz,
  scheduled_window_end timestamptz,
  estimated_delivery_minutes int check (estimated_delivery_minutes > 0),

  assigned_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,

  reassignment_requested boolean not null default false,

  rating smallint check (rating between 1 and 5),
  rating_comment text,
  rating_recorded_by uuid references profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- business_customer_id's own business_id must match this delivery's
  -- business_id. Enforced in the create_delivery RPC (0013), since a
  -- cross-table CHECK against another table isn't expressible directly --
  -- flagging that split of responsibility here so it isn't assumed the
  -- schema alone guarantees it.
  constraint deliveries_failure_reason_requires_failed check (
    (status = 'failed') = (failure_reason is not null)
  )
);

create index idx_deliveries_business_status on deliveries (business_id, status);
create index idx_deliveries_business_customer on deliveries (business_customer_id);
create index idx_deliveries_assigned_rider on deliveries (assigned_rider_id) where assigned_rider_id is not null;
-- Deterministic dispatch-queue ordering (Stage 9/11 refinement): priority,
-- then creation time, then id as the final tiebreak.
create index idx_deliveries_queue_order on deliveries (business_id, priority, created_at, id)
  where status = 'ready_for_dispatch';

comment on column deliveries.business_id is
  'Denormalized from business_customers.business_id for query/RLS performance -- see Phase 2 report. Kept in sync only at creation time by create_delivery(); never independently updatable.';
