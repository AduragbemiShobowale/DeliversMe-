-- 0001_extensions_and_enums.sql
-- Phase 2: extensions and shared enum types.

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "pg_cron"; -- scheduled assignment-timeout sweep (0016)

create type user_role as enum ('admin', 'owner', 'rider', 'customer');

create type business_verification_status as enum ('pending', 'verified', 'suspended');

create type rider_availability as enum ('available', 'busy', 'offline');

create type business_customer_status as enum ('pending_invitation', 'active');

create type delivery_priority as enum ('normal', 'urgent');

-- Matches the approved graph-based state machine (Stage 6, corrected doc 10 §10).
-- No linear CHECK on transitions here deliberately -- legal transitions are
-- enforced exclusively by the RPC functions in 0013/0014/0015, never by a
-- raw client-side UPDATE. See those files' comments for the transition table.
create type delivery_status as enum (
  'ready_for_dispatch',
  'assigned',
  'accepted',
  'in_transit',
  'delivered',
  'failed'
);

create type delivery_event_type as enum (
  'created',
  'priority_updated',
  'assigned',
  'accepted',
  'rejected',
  'expired',
  'started',
  'reassignment_requested',
  'reassignment_denied',
  'reassigned',
  'location_updated',
  'proof_uploaded',
  'proof_corrected',
  'delivered',
  'failed',
  'rating_recorded',
  'admin_intervened'
);

create type event_actor_role as enum ('owner', 'rider', 'admin', 'system');

create type reassignment_status as enum ('pending', 'approved', 'denied');

create type resolver_role as enum ('owner', 'admin');
