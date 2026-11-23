alter table public.works drop constraint works_room_id_slot_key;
alter table public.works add constraint works_room_id_slot_key unique(room_id,slot) deferrable initially immediate;

create function public.place_gallery_work(work_key uuid, destination integer) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); original integer;
begin
  if owner_id is null or destination is null or destination not between 1 and 8 then raise exception 'Invalid position'; end if;
  perform 1 from public.rooms where id=owner_id for update;
  select slot into strict original from public.works where id=work_key and room_id=owner_id and ready for update;
  if original=destination then return; end if;
  update public.works set slot=case when id=work_key then destination else original end
    where room_id=owner_id and (id=work_key or slot=destination);
  update public.rooms set music_slot=case music_slot when original then destination else original end
    where id=owner_id and music_slot in(original,destination);
end;
$$;
revoke all on function public.place_gallery_work(uuid,integer) from public,anon;
grant execute on function public.place_gallery_work(uuid,integer) to authenticated;

create function gallery_internal.clear_soundtrack() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.rooms set music_slot=null where id=old.room_id and music_slot=old.slot;
  return old;
end;
$$;
create trigger clear_soundtrack after delete on public.works for each row execute function gallery_internal.clear_soundtrack();
revoke all on function gallery_internal.clear_soundtrack() from public,anon,authenticated;
