-- =====================================================================
-- DeliverSME Lagos — 005 storage buckets and realtime
-- =====================================================================

-- Avatars / business logos: public read, owner-only write under <uid>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Proof of delivery: private, path <delivery_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only the assigned rider, while the job is at the drop-off, may upload proof.
create policy proofs_insert_rider on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and exists (
      select 1 from public.deliveries d
       where d.id = app.try_uuid((storage.foldername(name))[1])
         and d.rider_id = auth.uid()
         and d.status in ('in_transit', 'arrived')
    )
  );
-- Parties to the delivery (and admins) may read proof.
create policy proofs_select_parties on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and app.can_view_delivery(app.try_uuid((storage.foldername(name))[1])));

-- Realtime (postgres_changes respects RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.deliveries,
      public.delivery_status_history, public.rider_profiles;
  end if;
end $$;
