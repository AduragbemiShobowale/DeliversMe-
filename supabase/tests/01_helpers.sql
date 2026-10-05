create schema tests;
grant usage on schema tests to public;
create function tests.ok(p boolean, p_label text) returns void language plpgsql as $$
begin
  if p is distinct from true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;
create function tests.fails(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS: % (blocked: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — statement succeeded but should have been blocked', p_label;
end $$;
-- counts rows the *current role* can see
create function tests.count_visible(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin execute 'select count(*) from (' || p_sql || ') q' into n; return n; end $$;
grant execute on all functions in schema tests to public;
