create table public.rooms (
  id uuid primary key references auth.users(id) on delete cascade,
  title text not null default 'Mi primera sala' check (length(trim(title)) between 1 and 72),
  artist text not null check (length(trim(artist)) between 1 and 48),
  description text not null default '' check (length(description) <= 420),
  category text not null default 'Digital' check (category in ('Digital','Fotografía','Música','Video','Pintura','Escultura')),
  wall_color text not null default '#a59483' check (wall_color ~ '^#[0-9a-fA-F]{6}$'),
  finish text not null default 'Piedra' check (finish in ('Piedra','Madera','Basalto')),
  music_slot smallint check (music_slot between 1 and 8),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index rooms_catalog on public.rooms (created_at desc, id) where published;
create index rooms_by_category on public.rooms (category, created_at desc, id) where published;
alter table public.rooms enable row level security;
revoke all on public.rooms from public, anon, authenticated;
grant select on public.rooms to anon, authenticated;
grant update (title, artist, description, category, wall_color, finish, music_slot, published) on public.rooms to authenticated;
create policy visible_rooms on public.rooms for select using (published or id=(select auth.uid()));
create policy edit_own_room on public.rooms for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create schema if not exists gallery_internal;
revoke all on schema gallery_internal from public, anon, authenticated;
create function gallery_internal.provision_room() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rooms(id, artist) values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'artist'),48),''),'Artista'));
  return new;
end;
$$;
create trigger provision_gallery after insert on auth.users for each row execute function gallery_internal.provision_room();

create table public.works (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  slot smallint not null check (slot between 1 and 8),
  title text not null check (length(trim(title)) between 1 and 80),
  extension text not null check (extension in ('webp','mp4','webm','mp3','ogg','wav','m4a')),
  ready boolean not null default false,
  unique(room_id, slot)
);
alter table public.works enable row level security;
revoke all on public.works from public, anon, authenticated;
grant select on public.works to anon, authenticated;
grant insert (id, room_id, slot, title, extension), update (title, ready), delete on public.works to authenticated;
create policy visible_works on public.works for select using (
  room_id=(select auth.uid()) or (ready and exists(select 1 from public.rooms r where r.id=room_id and r.published))
);
create policy create_work on public.works for insert to authenticated with check (room_id=(select auth.uid()));
create policy edit_work on public.works for update to authenticated using (room_id=(select auth.uid())) with check (room_id=(select auth.uid()));
create policy remove_work on public.works for delete to authenticated using (room_id=(select auth.uid()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('gallery-art','gallery-art',true,12582912,array['image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','audio/mp4']);
create policy upload_reserved_object on storage.objects for insert to authenticated with check (
  bucket_id='gallery-art' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.works w where w.room_id=(select auth.uid())
    and name=w.room_id::text||'/'||w.id::text||'.'||w.extension and not w.ready)
);
create policy read_own_objects on storage.objects for select to authenticated using (
  bucket_id='gallery-art' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy delete_own_objects on storage.objects for delete to authenticated using (
  bucket_id='gallery-art' and (storage.foldername(name))[1]=(select auth.uid())::text
);

-- Keeping the slot occupied until Storage confirms removal bounds abandoned uploads.
create function gallery_internal.check_object() returns trigger
language plpgsql security definer set search_path = '' as $$
declare object_exists boolean;
begin
  select exists(select 1 from storage.objects where bucket_id='gallery-art'
    and name=old.room_id::text||'/'||old.id::text||'.'||old.extension) into object_exists;
  if tg_op='DELETE' then
    if object_exists then raise exception 'Remove the stored file first'; end if;
    return old;
  end if;
  if new.ready and not object_exists then raise exception 'Upload the file first'; end if;
  return new;
end;
$$;
create trigger check_work_file before update of ready or delete on public.works for each row execute function gallery_internal.check_object();
revoke all on all functions in schema gallery_internal from public, anon, authenticated;
