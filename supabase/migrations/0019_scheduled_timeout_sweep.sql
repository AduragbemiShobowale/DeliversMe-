-- 0019_scheduled_timeout_sweep.sql
-- Phase 2 §7: server-authoritative assignment timeout, 5-minute default.
-- pg_cron invokes this function every 60 seconds. Not GRANTed to
-- 'authenticated' -- only pg_cron's internal scheduling context calls it.

create or replace function sweep_expired_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired record;
  v_count int := 0;
begin
  for v_expired in
    select d.id as delivery_id, d.assigned_rider_id, b.owner_profile_id
    from deliveries d
    join businesses b on b.id = d.business_id
    where d.status = 'assigned'
      and d.assigned_at + make_interval(mins => b.assignment_timeout_minutes) < now()
    for update of d skip locked -- concurrent sweep runs never double-process a row
  loop
    update deliveries
    set status = 'ready_for_dispatch', assigned_rider_id = null, assigned_at = null
    where id = v_expired.delivery_id;

    perform recompute_rider_availability(v_expired.assigned_rider_id);

    perform log_delivery_event(
      v_expired.delivery_id, 'expired', null, 'system',
      '{}'::jsonb,
      p_notify_recipient => v_expired.owner_profile_id,
      p_notify_title => 'Assignment expired',
      p_notify_message => 'No response within the assignment window. The delivery has returned to the dispatch queue.'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function sweep_expired_assignments is
  'Not GRANTed to authenticated -- invoked exclusively by the pg_cron job below (or manually by an operator with sufficient privileges). This is the server-authoritative mechanism from Phase 2 §7 -- the rider-facing countdown UI is a display only, per that section''s explicit instruction.';

select cron.schedule(
  'sweep-expired-assignments',
  '* * * * *', -- every 60 seconds
  $$ select sweep_expired_assignments(); $$
);
