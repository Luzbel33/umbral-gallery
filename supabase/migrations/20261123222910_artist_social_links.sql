alter table public.rooms
  add column social_url_2 text not null default '' check (gallery_internal.safe_link(social_url_2)),
  add column social_url_3 text not null default '' check (gallery_internal.safe_link(social_url_3));
grant update(social_url_2,social_url_3) on public.rooms to authenticated;
