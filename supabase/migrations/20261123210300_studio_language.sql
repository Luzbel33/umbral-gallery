-- Keep room creation idempotent when two tabs open the studio together.
create function public.create_my_gallery(ui_language text) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Ingresá para crear una sala'; end if;
  insert into public.rooms(id,title,artist)
    select owner_id,
           case when ui_language='en' then 'My first room' else 'Mi primera sala' end,
           coalesce(nullif(left(trim(raw_user_meta_data->>'artist'),48),''),
                    case when ui_language='en' then 'Artist' else 'Artista' end)
      from auth.users where id=owner_id
    on conflict(id) do nothing;
  return owner_id;
end $$;
revoke all on function public.create_my_gallery(text) from public,anon;
grant execute on function public.create_my_gallery(text) to authenticated;

create or replace function public.create_my_gallery() returns uuid
language sql security invoker set search_path='' as $$
  select public.create_my_gallery('es'::text);
$$;
