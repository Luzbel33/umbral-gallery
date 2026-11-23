create function public.mount_gallery_work(work_key uuid,destination integer,work_title text,work_medium text,work_year integer,work_caption text,work_angle integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.place_gallery_work(work_key,destination);
  update public.works set title=work_title,medium=work_medium,year=work_year,caption=work_caption,orientation=work_angle
    where id=work_key and room_id=auth.uid() and ready;
  if not found then raise exception 'Work unavailable'; end if;
end $$;
revoke all on function public.mount_gallery_work(uuid,integer,text,text,integer,text,integer) from public,anon;
grant execute on function public.mount_gallery_work(uuid,integer,text,text,integer,text,integer) to authenticated;

create or replace function public.set_gallery_favorite(room_key text, saved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or room_key is null or saved is null then raise exception 'Ingresá para guardar salas'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,18));
  if not saved then delete from public.gallery_favorites f where f.user_id=actor and f.room_key=$1;return;end if;
  if room_key not in ('orbital','frecuencia','intervalos','estratos','patio','taller') and
     not exists(select 1 from public.rooms r where r.id::text=$1 and (r.published or r.id=actor)) then raise exception 'Sala no disponible';end if;
  if exists(select 1 from public.gallery_favorites f where f.user_id=actor and f.room_key=$1) then return; end if;
  if (select count(*) from public.gallery_favorites where user_id=actor)>=100 then raise exception 'El máximo es de 100 favoritos';end if;
  insert into public.gallery_favorites values(actor,$1);
end $$;
