-- A discovery card needs one image. Heavy room details are fetched on entry.
create view public.gallery_catalog with (security_invoker=true) as
select r.id,r.title,r.artist,r.category,r.wall_color,r.created_at,
 (select w.id from public.works w where w.room_id=r.id and w.ready and w.extension='webp' order by w.slot limit 1) as cover_id
 from public.rooms r where r.published;
revoke all on public.gallery_catalog from public,anon,authenticated;
grant select on public.gallery_catalog to anon,authenticated;
