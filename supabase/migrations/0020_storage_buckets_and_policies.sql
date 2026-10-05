-- 0020_storage_buckets_and_policies.sql
-- Phase 2: two private buckets, both path-namespaced
-- business_id/delivery_id/filename so RLS can scope access identically to
-- the table-level policies above. Neither bucket is public.

insert into storage.buckets (id, name, public)
values
  ('proof-of-delivery', 'proof-of-delivery', false),
  ('reassignment-evidence', 'reassignment-evidence', false)
on conflict (id) do nothing;

-- Helper: extracts the business_id (first path segment) from an object
-- name, so policies can compare it against current_business_id() without
-- repeating the split logic in every policy body.
create or replace function storage_path_business_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(object_name, '/'))[1]::uuid;
$$;

create or replace function storage_path_delivery_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(object_name, '/'))[2]::uuid;
$$;


-- proof-of-delivery bucket
create policy pod_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'proof-of-delivery'
    and storage_path_business_id(name) = (select business_id from deliveries where id = storage_path_delivery_id(name))
    and storage_path_delivery_id(name) in (
      select id from deliveries where assigned_rider_id = auth.uid()
    )
  );

create policy pod_storage_select on storage.objects
  for select
  using (
    bucket_id = 'proof-of-delivery'
    and (
      storage_path_business_id(name) = current_business_id()
      or storage_path_delivery_id(name) in (select id from deliveries where assigned_rider_id = auth.uid())
      or storage_path_delivery_id(name) in (
        select d.id from deliveries d
        join business_customers bc on bc.id = d.business_customer_id
        where bc.customer_profile_id = auth.uid()
      )
    )
  );

-- No UPDATE/DELETE policy on this bucket for any role -- append-only,
-- matching the proof_of_delivery table's own versioning design (0006/0012).


-- reassignment-evidence bucket (Phase 2 §6's optional evidence photo)
create policy evidence_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'reassignment-evidence'
    and storage_path_delivery_id(name) in (
      select id from deliveries where assigned_rider_id = auth.uid() and status = 'in_transit'
    )
  );

create policy evidence_storage_select on storage.objects
  for select
  using (
    bucket_id = 'reassignment-evidence'
    and (
      storage_path_business_id(name) = current_business_id()
      or storage_path_delivery_id(name) in (select id from deliveries where assigned_rider_id = auth.uid())
      or is_admin() -- admin reviewing an escalated reassignment needs to see the evidence photo
    )
  );

comment on policy evidence_storage_select on storage.objects is
  'Admin SELECT here is intentionally broader than the deliveries table itself (which grants admin no default SELECT) -- an admin resolving an escalated reassignment via admin_resolve_reassignment (0016) needs to view the submitted evidence. Narrower than a blanket grant would require passing signed URLs through the RPC layer instead; flagged as a deliberate, scoped exception rather than an oversight.';
