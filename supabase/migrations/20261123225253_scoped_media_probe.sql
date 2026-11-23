create or replace function public.probe_gallery_media(owner_key uuid) returns void
language sql security definer set search_path='' as $$
  update gallery_internal.media_rollout set probe_room=owner_key where singleton;
$$;
