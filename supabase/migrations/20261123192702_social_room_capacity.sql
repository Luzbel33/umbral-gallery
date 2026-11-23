create table gallery_internal.visits (
  ticket uuid primary key default gen_random_uuid(),
  room text not null,
  instance integer not null,
  expires_at timestamptz not null
);
create index visits_room on gallery_internal.visits(room,instance);
create index visits_expiry on gallery_internal.visits(expires_at);
revoke all on gallery_internal.visits from public, anon, authenticated;

create function public.join_gallery_visit(room_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  active_count integer;
  chosen integer;
  lease uuid;
begin
  if room_key is null or length(room_key)>36 then return null; end if;
  if room_key not in ('orbital','frecuencia','intervalos','estratos') then
    if room_key !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return null; end if;
    if not exists(select 1 from public.rooms where id=room_key::uuid and (published or id=auth.uid())) then return null; end if;
  end if;
  -- One short allocation transaction keeps the pilot's global and per-room limits atomic.
  perform pg_catalog.pg_advisory_xact_lock(31941, 811);
  delete from gallery_internal.visits where expires_at <= now();
  select count(*) into active_count from gallery_internal.visits;
  if active_count>=120 then return null; end if;
  select candidate into chosen from generate_series(1,10) as candidate
    left join gallery_internal.visits v on v.room=room_key and v.instance=candidate
    group by candidate having count(v.ticket)<12 order by candidate limit 1;
  insert into gallery_internal.visits(room,instance,expires_at)
    values(room_key,chosen,now()+interval '100 seconds') returning ticket into lease;
  return jsonb_build_object('ticket',lease,'instance',chosen);
end;
$$;
create function public.renew_gallery_visit(lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update gallery_internal.visits set expires_at=now()+interval '100 seconds'
    where ticket=lease and expires_at>now();
  return found;
end;
$$;
create function public.leave_gallery_visit(lease uuid) returns void
language sql security definer set search_path='' as $$
  delete from gallery_internal.visits where ticket=lease;
$$;
revoke all on function public.join_gallery_visit(text), public.renew_gallery_visit(uuid), public.leave_gallery_visit(uuid) from public;
grant execute on function public.join_gallery_visit(text), public.renew_gallery_visit(uuid), public.leave_gallery_visit(uuid) to anon, authenticated;
