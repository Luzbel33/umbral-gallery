alter table public.rooms
  add column room_size text not null default 'standard' check (room_size in ('intimate','standard','spacious')),
  add column label_style text not null default 'wall' check (label_style in ('wall','paper','hidden'));
alter table public.works
  add column medium text not null default '' check(length(medium)<=64),
  add column year smallint check(year between 1 and 9999),
  add column caption text not null default '' check(length(caption)<=320),
  add column orientation smallint not null default 0 check(orientation between 0 and 359);
grant update(room_size,label_style) on public.rooms to authenticated;
grant update(medium,year,caption,orientation) on public.works to authenticated;

-- Only the account service can issue a confirmed internal password identity.
create function gallery_internal.guard_handle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Auth attaches admin-only metadata after inserting the user in the same transaction.
  if exists(select 1 from auth.users u where u.id=new.id and split_part(u.email,'@',2)='members.umbral.invalid'
    and u.raw_app_meta_data->>'umbral_handle' is distinct from split_part(u.email,'@',1))
  then raise exception 'Reserved account namespace'; end if;
  return null;
end $$;
create constraint trigger umbral_handle_identity after insert or update of email on auth.users
  deferrable initially deferred for each row when (split_part(new.email,'@',2)='members.umbral.invalid')
  execute function gallery_internal.guard_handle();
revoke all on function gallery_internal.guard_handle() from public,anon,authenticated;

create table gallery_internal.account_windows (
  bucket text primary key, starts_at timestamptz not null, hits integer not null
);
revoke all on gallery_internal.account_windows from public,anon,authenticated;
create function public.gallery_account_budget(network_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  start_time timestamptz := date_bin(interval '10 minutes',now(),timestamptz '2026-01-01');
  k text; n integer;
begin
  if network_hash !~ '^[0-9a-f]{64}$' or network_hash is null then return false; end if;
  foreach k in array array[network_hash,'all'] loop
    insert into gallery_internal.account_windows as w values(k,start_time,1)
    on conflict(bucket) do update set starts_at=start_time,
      hits=case when w.starts_at=start_time then w.hits+1 else 1 end
    returning hits into n;
    if n>(case when k='all' then 300 else 24 end) then return false; end if;
  end loop;
  delete from gallery_internal.account_windows where starts_at<start_time;
  return true;
end $$;
create function public.gallery_recovery_user(member_email text, recovery_digest text)
returns uuid language sql stable security definer set search_path='' as $$
  select id from auth.users where email=member_email
    and raw_app_meta_data->>'umbral_handle'=split_part(member_email,'@',1)
    and raw_app_meta_data->>'umbral_backup'=recovery_digest;
$$;
revoke all on function public.gallery_account_budget(text), public.gallery_recovery_user(text,text) from public,anon,authenticated;
grant execute on function public.gallery_account_budget(text), public.gallery_recovery_user(text,text) to service_role;

-- Drafts occupy artist seats too. A repeat request from the same owner is idempotent.
create function gallery_internal.artist_seat() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(31941,812);
  if not exists(select 1 from public.rooms where id=new.id) and
     (select count(*) from public.rooms)>=100 then raise exception 'PILOT_ARTISTS_FULL'; end if;
  return new;
end $$;
create trigger limit_artist_rooms before insert on public.rooms for each row execute function gallery_internal.artist_seat();

create function gallery_internal.artwork_seat() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.rooms where id=new.room_id for update;
  if (select count(*) from public.works where room_id=new.room_id)>=4 then raise exception 'PILOT_WORKS_FULL'; end if;
  return new;
end $$;
create trigger limit_gallery_works before insert on public.works for each row execute function gallery_internal.artwork_seat();

update storage.buckets set file_size_limit=8388608 where id='gallery-art';
-- Use the actual byte size recorded by Storage, including failed-finish reservations' files.
create function gallery_internal.artist_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare prefix text:=split_part(new.name,'/',1); total bigint;
begin
  if new.bucket_id<>'gallery-art' or coalesce((new.metadata->>'size')::bigint,0)=0 then return new; end if;
  if tg_op='UPDATE' and old.bucket_id=new.bucket_id and old.name=new.name and
     coalesce((old.metadata->>'size')::bigint,0)>=(new.metadata->>'size')::bigint then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(prefix,74));
  select coalesce(sum((metadata->>'size')::bigint),0) into total from storage.objects
    where bucket_id='gallery-art' and name like prefix||'/%';
  if total>8388608 then raise exception 'PILOT_BYTES_FULL'; end if;
  return new;
end $$;
create trigger umbral_artist_storage after insert or update of metadata,name,bucket_id on storage.objects
  for each row execute function gallery_internal.artist_storage();
revoke all on function gallery_internal.artist_seat(),gallery_internal.artwork_seat(),gallery_internal.artist_storage() from public,anon,authenticated;

create function public.my_gallery_bytes() returns bigint language sql stable security definer set search_path='' as $$
  select coalesce(sum((metadata->>'size')::bigint),0)::bigint from storage.objects
  where bucket_id='gallery-art' and name like auth.uid()::text||'/%';
$$;
revoke all on function public.my_gallery_bytes() from public,anon,authenticated;
grant execute on function public.my_gallery_bytes() to authenticated;
