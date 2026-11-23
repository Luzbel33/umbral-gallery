-- Keep the existing editor usable until the operator verifies worldwide delivery.
create table gallery_internal.media_rollout (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  probe_room uuid references auth.users(id) on delete set null
);
insert into gallery_internal.media_rollout default values;
revoke all on gallery_internal.media_rollout from public, anon, authenticated;

alter table public.works
  add column cloud_bytes integer not null default 0 check(cloud_bytes between 0 and 33554432),
  add column preview_bytes integer not null default 0 check(preview_bytes between 0 and 65536),
  add column cloud_url text,
  add column preview_url text;
create table gallery_internal.media_locks (
  work_id uuid primary key references public.works(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
revoke all on gallery_internal.media_locks from public, anon, authenticated;

-- An operator can exercise the hosted path in one private room before the public rollout.
create function public.probe_gallery_media(owner_key uuid) returns void
language sql security definer set search_path='' as $$
  update gallery_internal.media_rollout set probe_room=owner_key;
$$;
revoke all on function public.probe_gallery_media(uuid) from public,anon,authenticated;
grant execute on function public.probe_gallery_media(uuid) to service_role;

create function gallery_internal.cloud_used(owner_key uuid) returns bigint
language sql stable set search_path='' as $$
  select coalesce(sum(cloud_bytes+preview_bytes),0) from public.works where room_id=owner_key;
$$;
revoke all on function gallery_internal.cloud_used(uuid) from public,anon,authenticated;

create or replace function public.my_gallery_budget() returns jsonb
language sql stable security definer set search_path='' as $$
  with usage as (
    select used_bytes as legacy, extra_bytes, gallery_internal.cloud_used(auth.uid()) as newer,
           (select enabled or coalesce(probe_room=auth.uid(),false) from gallery_internal.media_rollout) as cloud
    from gallery_internal.gallery_space(auth.uid()::text)
  ), budget as (
    select *, greatest(0,50331648-legacy-newer) as remaining,
      greatest(0,6291456-legacy)+greatest(0,209715200-extra_bytes) as legacy_remaining from usage
  )
  select jsonb_build_object('used',legacy+newer,'cloud',cloud,
    'available',case when cloud then remaining else least(remaining,legacy_remaining) end,
    'legacy_available',least(remaining,legacy_remaining)) from budget;
$$;

create function public.reserve_gallery_upload(work_key uuid, work_title text, filename text, ext text, bytes integer, thumb integer)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); place smallint; budget jsonb;
begin
  if owner_id is null or work_key is null or bytes is null or thumb is null or ext is null
     or bytes not between 1 and 33554432 or thumb not between 0 and 65536
     or ext not in ('mp4','webm','mov','ogv','mp3','m4a','flac','wav','ogg','webp','txt','mesh')
     or (ext<>'webp' and thumb<>0) or (ext='txt' and bytes>524288)
     or (ext in ('webp','txt','mesh') and bytes>10000000)
     then raise exception 'Invalid upload'; end if;
  perform 1 from public.rooms where id=owner_id for update;
  if not found then raise exception 'Room unavailable'; end if;
  perform pg_advisory_xact_lock(31941,814);
  select public.my_gallery_budget() into budget;
  if not (budget->>'cloud')::boolean then raise exception 'Cloud storage unavailable'; end if;
  if bytes+thumb>(budget->>'available')::bigint then raise exception 'PILOT_BYTES_FULL'; end if;
  select n into place from generate_series(1,8)n where not exists(select 1 from public.works where room_id=owner_id and slot=n) order by n limit 1;
  insert into public.works(id,room_id,slot,title,extension,source_name,cloud_bytes,preview_bytes,has_preview)
  values(work_key,owner_id,place,work_title,ext,filename,bytes,thumb,thumb>0);
end $$;
revoke all on function public.reserve_gallery_upload(uuid,text,text,text,integer,integer) from public,anon;
grant execute on function public.reserve_gallery_upload(uuid,text,text,text,integer,integer) to authenticated;

create or replace function gallery_internal.artist_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare usage record; owner_key text:=split_part(new.name,'/',1);
begin
  if new.bucket_id<>'gallery-art' or coalesce((new.metadata->>'size')::bigint,0)=0 then return new; end if;
  if tg_op='UPDATE' and old.bucket_id=new.bucket_id and old.name=new.name and
    coalesce((old.metadata->>'size')::bigint,0)>=(new.metadata->>'size')::bigint then return new; end if;
  perform pg_advisory_xact_lock(31941,814);
  select * into usage from gallery_internal.gallery_space(owner_key);
  if usage.used_bytes+gallery_internal.cloud_used(owner_key::uuid)>50331648 or usage.extra_bytes>209715200 then raise exception 'PILOT_BYTES_FULL'; end if;
  return new;
end $$;
alter policy upload_reserved_object on storage.objects with check (
  bucket_id='gallery-art' and exists(select 1 from public.works w where w.room_id=(select auth.uid())
  and w.cloud_bytes=0 and not w.ready and name=w.room_id::text||'/'||w.id::text||'.'||w.extension)
);
alter policy upload_reserved_preview on storage.objects with check (
  bucket_id='gallery-art' and exists(select 1 from public.works w where w.room_id=(select auth.uid())
  and w.cloud_bytes=0 and w.has_preview and not w.ready and name=w.room_id::text||'/'||w.id::text||'.preview.webp')
);
alter policy remove_work on public.works using(room_id=(select auth.uid()) and cloud_bytes=0);

create function public.lock_gallery_media(owner_key uuid,work_key uuid,lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.works where id=work_key and room_id=owner_key and cloud_bytes>0 for update;
  if not found then return false; end if;
  insert into gallery_internal.media_locks as l values(work_key,lease,now()+interval '2 minutes')
    on conflict(work_id) do update set token=excluded.token,expires_at=excluded.expires_at where l.expires_at<now();
  return found;
end $$;
create function public.unlock_gallery_media(work_key uuid,lease uuid) returns void
language sql security definer set search_path='' as $$
 delete from gallery_internal.media_locks where work_id=work_key and token=lease;
$$;
revoke all on function public.lock_gallery_media(uuid,uuid,uuid),public.unlock_gallery_media(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lock_gallery_media(uuid,uuid,uuid),public.unlock_gallery_media(uuid,uuid) to service_role;

create or replace function gallery_internal.check_object() returns trigger language plpgsql security definer set search_path='' as $$
declare original text:=old.room_id::text||'/'||old.id::text||'.'||old.extension;
 thumbnail text:=old.room_id::text||'/'||old.id::text||'.preview.webp';
begin
 if old.cloud_bytes>0 then
   if tg_op='DELETE' then return old; end if;
   if new.ready and (new.cloud_url is null or (new.has_preview and new.preview_url is null)) then raise exception 'Upload the file first';end if;
   return new;
 end if;
 if tg_op='DELETE' then
   if exists(select 1 from storage.objects where bucket_id='gallery-art' and name in(original,thumbnail)) then raise exception 'Remove the stored file first';end if;
   return old;
 end if;
 if new.ready and (not exists(select 1 from storage.objects where bucket_id='gallery-art' and name=original)
    or (new.has_preview and not exists(select 1 from storage.objects where bucket_id='gallery-art' and name=thumbnail))) then raise exception 'Upload the file first';end if;
 return new;
end $$;

create or replace view public.gallery_catalog with(security_invoker=true) as
 select r.id,r.title,r.artist,r.category,r.wall_color,r.created_at,w.id as cover_id,coalesce(w.has_preview,false) as cover_preview,
 coalesce(w.preview_url,w.cloud_url) as cover_url
 from public.rooms r left join lateral(select id,has_preview,cloud_url,preview_url from public.works where room_id=r.id and ready and extension='webp' order by slot limit 1) w on true where r.published;
