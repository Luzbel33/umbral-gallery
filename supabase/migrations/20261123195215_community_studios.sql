-- Existing studio owners keep their rooms. New accounts choose when to open one.
drop trigger if exists provision_gallery on auth.users;
drop function if exists gallery_internal.provision_room();
create function public.create_my_gallery() returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Ingresá para crear una sala'; end if;
  insert into public.rooms(id,artist) select owner_id,coalesce(nullif(left(trim(raw_user_meta_data->>'artist'),48),''),'Artista')
    from auth.users where id=owner_id on conflict(id) do nothing;
  return owner_id;
end $$;
revoke all on function public.create_my_gallery() from public,anon;
grant execute on function public.create_my_gallery() to authenticated;

alter table public.rooms drop constraint rooms_category_check;
alter table public.rooms add constraint rooms_category_check check(category in ('Digital','Fotografía','Música','Video','Pintura','Escultura','Programación','Diseño','Literatura','Multidisciplinaria'));
create function gallery_internal.safe_link(s text) returns boolean language sql immutable set search_path='' as $$
 select s='' or (length(s)<=420 and s ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$')
$$;
alter table public.rooms add column website text not null default '' check(gallery_internal.safe_link(website)),
 add column social_url text not null default '' check(gallery_internal.safe_link(social_url)),
 add column project_url text not null default '' check(gallery_internal.safe_link(project_url));
grant update(website,social_url,project_url) on public.rooms to authenticated;
alter table public.works drop constraint works_extension_check;
alter table public.works add constraint works_extension_check check(extension in ('webp','mp4','webm','mp3','ogg','wav','m4a','flac','ogv','mov','txt','pdf','mesh'));
alter table public.works add column source_name text not null default '' check(length(source_name)<=120);
grant insert(source_name) on public.works to authenticated;
update storage.buckets set allowed_mime_types=array['image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','audio/mp4','audio/flac','video/ogg','video/quicktime','text/plain','application/pdf','application/octet-stream'] where id='gallery-art';

create table public.gallery_favorites(user_id uuid not null references auth.users(id) on delete cascade, room_key text not null, primary key(user_id,room_key));
alter table public.gallery_favorites enable row level security;
revoke all on public.gallery_favorites from public,anon,authenticated;
grant select on public.gallery_favorites to authenticated;
create policy own_favorites on public.gallery_favorites for select to authenticated using(user_id=(select auth.uid()));
create function public.set_gallery_favorite(room_key text, saved boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or room_key is null or saved is null then raise exception 'Ingresá para guardar salas'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,18));
 if not saved then delete from public.gallery_favorites f where f.user_id=actor and f.room_key=$1;return;end if;
 if room_key not in ('orbital','frecuencia','intervalos','estratos','patio') and not exists(select 1 from public.rooms r where r.id::text=$1 and (r.published or r.id=actor)) then raise exception 'Sala no disponible';end if;
 if exists(select 1 from public.gallery_favorites f where f.user_id=actor and f.room_key=$1) then return; end if;
 if (select count(*) from public.gallery_favorites where user_id=actor)>=100 then raise exception 'El máximo es de 100 favoritos';end if;
 insert into public.gallery_favorites values(actor,$1);
end $$;
revoke all on function public.set_gallery_favorite(text,boolean) from public,anon;
grant execute on function public.set_gallery_favorite(text,boolean) to authenticated;

alter table gallery_internal.visits add column actor uuid default auth.uid(),add column peer uuid not null default gen_random_uuid(),
 add column nick text not null default 'Visitante', add column x real default 0,add column z real default 6.6,add column yaw real default 0,
 add column voice_until timestamptz,add column last_packet timestamptz;
create unlogged table gallery_internal.chat(id bigint generated always as identity primary key,room text not null,instance integer not null,
 actor uuid not null,nick text not null,body text not null,created_at timestamptz not null default now());
create index chat_group on gallery_internal.chat(room,instance,id desc);
create index chat_cleanup on gallery_internal.chat(created_at);
create index chat_pause on gallery_internal.chat(actor,created_at desc);
revoke all on gallery_internal.chat from public,anon,authenticated;

create or replace function public.join_gallery_visit(room_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen integer;v gallery_internal.visits; display_name text;
begin
 if room_key is null or length(room_key)>36 then return null;end if;
 if room_key not in ('patio','orbital','frecuencia','intervalos','estratos') then
  if room_key !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return null;end if;
  if not exists(select 1 from public.rooms where id=room_key::uuid and (published or id=auth.uid())) then return null;end if;
 end if;
 perform pg_advisory_xact_lock(31941,811);
 delete from gallery_internal.visits where expires_at<=now();
 if (select count(*) from gallery_internal.visits)>=120 then return null;end if;
 select c into chosen from generate_series(1,20) c left join gallery_internal.visits v1 on v1.room=room_key and v1.instance=c
 group by c having count(v1.ticket)<6 order by c limit 1;
 select coalesce(nullif(left(trim(raw_user_meta_data->>'artist'),48),''),'Visitante') into display_name from auth.users where id=auth.uid();
 insert into gallery_internal.visits(room,instance,expires_at,actor,nick) values(room_key,chosen,now()+interval '100 seconds',auth.uid(),coalesce(display_name,'Visitante')) returning * into v;
 return jsonb_build_object('ticket',v.ticket,'peer',v.peer,'instance',chosen,'voice_topic','voice:'||v.room||':'||chosen);
end $$;

create function public.gallery_snapshot(lease uuid,px real,pz real,angle real,since_id bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits; peers jsonb; messages jsonb;
begin
 select * into v from gallery_internal.visits where ticket=lease and actor is not distinct from auth.uid() and expires_at>now();
 if not found then return null;end if;
 if px between -8 and 8 and pz between -9 and 9 and angle between -10000 and 10000 then
  if v.x is distinct from px or v.z is distinct from pz or v.yaw is distinct from angle or v.expires_at<now()+interval '65 seconds' then
   update gallery_internal.visits set x=px,z=pz,yaw=angle,expires_at=now()+interval '100 seconds' where ticket=lease;
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',peer,'x',x,'z',z,'a',yaw,'nick',nick)),'[]') into peers from gallery_internal.visits where room=v.room and instance=v.instance and expires_at>now();
 select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') into messages from
 (select id,nick,body,created_at from gallery_internal.chat where room=v.room and instance=v.instance and id>greatest(since_id,0) and created_at>now()-interval '15 minutes' order by id desc limit 40) m;
 return jsonb_build_object('peers',peers,'messages',messages);
end $$;
create function public.gallery_say(lease uuid,message text) returns void language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits;
begin
 select * into strict v from gallery_internal.visits where ticket=lease and actor=auth.uid() and expires_at>now();
 if message is null or length(trim(message)) not between 1 and 400 then raise exception 'Escribí entre 1 y 400 caracteres';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.actor::text,19));
 if exists(select 1 from gallery_internal.chat where actor=v.actor and created_at>now()-interval '2 seconds') then raise exception 'Esperá dos segundos entre mensajes';end if;
 delete from gallery_internal.chat where created_at < now()-interval '15 minutes';
 insert into gallery_internal.chat(room,instance,actor,nick,body) values(v.room,v.instance,v.actor,v.nick,trim(message));
end $$;
-- Only the database can publish to the voice channel. Listeners must own an active seat.
create function public.gallery_can_hear(channel_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from gallery_internal.visits v where v.actor=auth.uid() and v.expires_at>now() and 'voice:'||v.room||':'||v.instance=channel_name)
$$;
create policy gallery_listen_voice on realtime.messages for select to authenticated using(extension='broadcast' and public.gallery_can_hear((select realtime.topic())));
create function public.gallery_voice(lease uuid,operation text,packet text default '') returns boolean language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits; stamp timestamptz:=clock_timestamp();
begin
 select * into strict v from gallery_internal.visits where ticket=lease and actor=auth.uid() and expires_at>stamp for update;
 if operation='end' then update gallery_internal.visits set voice_until=null where ticket=lease;return true;end if;
 if operation='begin' then
   perform pg_advisory_xact_lock(31941,812);
   if exists(select 1 from gallery_internal.visits where room=v.room and instance=v.instance and voice_until>stamp and ticket<>lease)
    or (select count(*) from gallery_internal.visits where voice_until>stamp and ticket<>lease)>=6 then return false;end if;
   update gallery_internal.visits set voice_until=stamp+interval '15 seconds',last_packet=null where ticket=lease;return true;
 end if;
 if operation<>'packet' or packet is null or v.voice_until is null or v.voice_until<stamp or v.last_packet>stamp-interval '430 milliseconds'
  or length(packet) not between 4 and 8540 or packet !~ '^[A-Za-z0-9+/]+={0,2}$' then return false;end if;
 update gallery_internal.visits set last_packet=stamp where ticket=lease;
 perform realtime.send(jsonb_build_object('from',v.peer,'nick',v.nick,'audio',packet),'audio','voice:'||v.room||':'||v.instance,true);
 return true;
end $$;
revoke all on function public.gallery_snapshot(uuid,real,real,real,bigint), public.gallery_say(uuid,text),public.gallery_can_hear(text),public.gallery_voice(uuid,text,text) from public,anon,authenticated;
grant execute on function public.gallery_snapshot(uuid,real,real,real,bigint) to anon,authenticated;
grant execute on function public.gallery_say(uuid,text),public.gallery_can_hear(text),public.gallery_voice(uuid,text,text) to authenticated;
