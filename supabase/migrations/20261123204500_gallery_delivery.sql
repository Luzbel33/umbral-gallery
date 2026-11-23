alter table public.rooms add column artist_bio text not null default '' check(length(artist_bio)<=700);
grant update(artist_bio) on public.rooms to authenticated;
alter table public.works add column has_preview boolean not null default false check(not has_preview or extension='webp');
grant insert(has_preview) on public.works to authenticated;
create policy upload_reserved_preview on storage.objects for insert to authenticated with check (
 bucket_id='gallery-art' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.works w where w.room_id=(select auth.uid()) and w.has_preview and not w.ready and name=w.room_id::text||'/'||w.id::text||'.preview.webp')
);
create or replace function gallery_internal.check_object() returns trigger language plpgsql security definer set search_path='' as $$
declare original text:=old.room_id::text||'/'||old.id::text||'.'||old.extension;
 thumbnail text:=old.room_id::text||'/'||old.id::text||'.preview.webp';
begin
 if tg_op='DELETE' then
   if exists(select 1 from storage.objects where bucket_id='gallery-art' and name in(original,thumbnail)) then raise exception 'Remove the stored file first';end if;
   return old;
 end if;
 if new.ready and (not exists(select 1 from storage.objects where bucket_id='gallery-art' and name=original)
    or (new.has_preview and not exists(select 1 from storage.objects where bucket_id='gallery-art' and name=thumbnail))) then raise exception 'Upload the file first';end if;
 return new;
end $$;
create or replace view public.gallery_catalog with(security_invoker=true) as
 select r.id,r.title,r.artist,r.category,r.wall_color,r.created_at,w.id as cover_id,coalesce(w.has_preview,false) as cover_preview
 from public.rooms r left join lateral(select id,has_preview from public.works where room_id=r.id and ready and extension='webp' order by slot limit 1) w on true where r.published;

-- A quiet group costs two response bytes. The revision excludes the caller's own pose.
create function public.gallery_updates(lease uuid,px real,pz real,angle real,since_id bigint default 0,known text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits; peers jsonb; revision text; messages jsonb; result jsonb:='{}';
begin
 select * into v from gallery_internal.visits where ticket=lease and actor is not distinct from auth.uid() and expires_at>now();
 if not found then return null;end if;
 if px between -8 and 8 and pz between -9 and 9 and angle between -10000 and 10000 then
  if (v.x,v.z,v.yaw) is distinct from (px,pz,angle) or v.expires_at<now()+interval '55 seconds' then
   update gallery_internal.visits set x=px,z=pz,yaw=angle,expires_at=now()+interval '100 seconds' where ticket=lease;
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_array(peer,x,z,yaw) order by peer),'[]') into peers from gallery_internal.visits where room=v.room and instance=v.instance and ticket<>lease and expires_at>now();
 revision:=md5(peers::text);
 if revision is distinct from known then result:=jsonb_build_object('r',revision,'p',peers);end if;
 select jsonb_agg(to_jsonb(m) order by id) into messages from (select id,nick,body,created_at from gallery_internal.chat where room=v.room and instance=v.instance and id>greatest(since_id,0) and created_at>now()-interval '15 minutes' order by id desc limit 40) m;
 if messages is not null then result:=result||jsonb_build_object('m',messages);end if;
 return result;
end $$;
revoke all on function public.gallery_updates(uuid,real,real,real,bigint,text) from public;
grant execute on function public.gallery_updates(uuid,real,real,real,bigint,text) to anon,authenticated;
