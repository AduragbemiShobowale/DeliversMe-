-- 0023_realtime_publication.sql
-- Real gap found while wiring the frontend's Realtime subscriptions
-- (Phase 4/continuous-build pass): postgres_changes events are only
-- broadcast for tables explicitly added to the supabase_realtime
-- publication. None of migrations 0001-0022 did this, so without this
-- file every Realtime subscription in the frontend would silently
-- receive nothing -- not an error, just no events, which is a
-- particularly easy failure mode to miss in testing.

alter publication supabase_realtime add table delivery_locations;
alter publication supabase_realtime add table deliveries;
alter publication supabase_realtime add table delivery_events;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table reassignment_requests;

comment on publication supabase_realtime is
  'Tables here broadcast postgres_changes events to subscribed clients. RLS still applies to Realtime -- a client only receives change events for rows it could otherwise SELECT, so adding a table here does not widen access, only enables live push for access already granted.';
