-- Releasing an empty room never removes a stored work or the visitor account.
create function public.release_my_gallery() returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform 1 from public.rooms where id=owner_id for update;
  if exists(select 1 from public.works where room_id=owner_id) then raise exception 'PILOT_ROOM_NOT_EMPTY'; end if;
  delete from public.rooms where id=owner_id;
  delete from public.gallery_favorites where room_key=owner_id::text;
end $$;
revoke all on function public.release_my_gallery() from public,anon;
grant execute on function public.release_my_gallery() to authenticated;
