-- Six MiB per prospective artist plus a two-hundred MiB common pool fits in 800 MiB.
create function gallery_internal.gallery_space(owner_key text)
returns table(used_bytes bigint, extra_bytes bigint)
language sql stable security definer set search_path='' as $$
  with usage as (
    select split_part(name,'/',1) as owner_key, sum(coalesce((metadata->>'size')::bigint,0))::bigint as bytes
    from storage.objects where bucket_id='gallery-art' group by 1
  )
  select coalesce(max(bytes) filter(where usage.owner_key=$1),0)::bigint,
         coalesce(sum(greatest(0,bytes-6291456)),0)::bigint from usage;
$$;
revoke all on function gallery_internal.gallery_space(text) from public,anon,authenticated;
create function public.my_gallery_budget() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('used',used_bytes,'available',greatest(0,least(
    50331648-used_bytes,greatest(0,6291456-used_bytes)+greatest(0,209715200-extra_bytes))))
  from gallery_internal.gallery_space(auth.uid()::text);
$$;
revoke all on function public.my_gallery_budget() from public,anon;
grant execute on function public.my_gallery_budget() to authenticated;
create or replace function gallery_internal.artist_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare usage record;
begin
  if new.bucket_id<>'gallery-art' or coalesce((new.metadata->>'size')::bigint,0)=0 then return new; end if;
  if tg_op='UPDATE' and old.bucket_id=new.bucket_id and old.name=new.name and
     coalesce((old.metadata->>'size')::bigint,0)>=(new.metadata->>'size')::bigint then return new; end if;
  perform pg_advisory_xact_lock(31941,814);
  select * into usage from gallery_internal.gallery_space(split_part(new.name,'/',1));
  if usage.used_bytes>50331648 or usage.extra_bytes>209715200 then raise exception 'PILOT_BYTES_FULL';end if;
  return new;
end $$;
drop function public.my_gallery_bytes();
update storage.buckets set file_size_limit=33554432 where id='gallery-art';

alter table public.works add column external_url text not null default '';
alter table public.works drop constraint works_extension_check;
alter table public.works add constraint works_extension_check check(extension in
  ('webp','mp4','webm','mp3','ogg','wav','m4a','flac','ogv','mov','txt','pdf','mesh','youtube','vimeo','soundcloud'));
alter table public.works add constraint work_link_matches check(
 (extension='youtube' and external_url ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$') or
 (extension='vimeo' and external_url ~ '^https://vimeo[.]com/[0-9]{1,12}$') or
 (extension='soundcloud' and external_url ~ '^https://soundcloud[.]com/[A-Za-z0-9_-]{1,100}/[A-Za-z0-9_-]{1,180}$') or
 (extension not in ('youtube','vimeo','soundcloud') and external_url=''));
create function public.add_gallery_link(work_title text,provider text,work_url text) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); place integer; added uuid;
begin
  if owner_id is null or provider not in ('youtube','vimeo','soundcloud') then raise exception 'Invalid media link'; end if;
  perform 1 from public.rooms where id=owner_id for update;
  if not found then raise exception 'Room unavailable'; end if;
  select n into place from generate_series(1,8)n where not exists(select 1 from public.works where room_id=owner_id and slot=n) order by n limit 1;
  insert into public.works(room_id,slot,title,extension,external_url,ready) values(owner_id,place,work_title,provider,work_url,true) returning id into added;
  return added;
end $$;
revoke all on function public.add_gallery_link(text,text,text) from public,anon;
grant execute on function public.add_gallery_link(text,text,text) to authenticated;
