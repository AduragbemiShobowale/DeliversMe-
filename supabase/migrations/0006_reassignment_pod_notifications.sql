-- 0006_reassignment_pod_notifications.sql
-- Phase 2 §13/§11/§6: reassignment requests (now with mandatory reason +
-- optional evidence photo, resolvable by owner or admin), versioned proof
-- of delivery, and recipient-scoped notifications.

create table reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  requested_by_rider_id uuid not null references riders (profile_id),
  reason text not null check (char_length(trim(reason)) > 0), -- mandatory per Phase 2 §6
  evidence_photo_url text, -- optional, per Phase 2 §6
  status reassignment_status not null default 'pending',
  decided_by_role resolver_role,
  decided_by_profile_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint reassignment_resolution_consistency check (
    (status = 'pending' and decided_by_role is null and resolved_at is null)
    or (status <> 'pending' and decided_by_role is not null and resolved_at is not null)
  )
);

create index idx_reassignment_delivery on reassignment_requests (delivery_id);
create index idx_reassignment_pending on reassignment_requests (delivery_id) where status = 'pending';

-- Versioned, append-only proof of delivery (Phase 2 §11). No is_current
-- column and no UPDATE grant at all -- "current" is computed as
-- MAX(version) at query time. A correction is always a new row.
create table proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  version int not null check (version > 0),
  photo_url text not null,
  recipient_name text,
  notes text,
  uploaded_by uuid not null references profiles (id),
  uploaded_at timestamptz not null default now(),

  constraint pod_unique_version unique (delivery_id, version)
);

create index idx_pod_delivery_version on proof_of_delivery (delivery_id, version desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  delivery_id uuid references deliveries (id) on delete cascade,
  source_event_id uuid references delivery_events (id), -- Stage 15/19 refinement
  notification_type delivery_event_type not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_profile_id, is_read, created_at desc);

comment on table notifications is
  'Recipient-scoped, filtered subset of delivery_events. Routine forward progress (e.g. started) never generates a row here -- see the RPCs in 0013 for exactly which events do.';
