-- Cloud uploads reserve their exact byte count before the provider receives a file.
create function gallery_internal.reject_oversized_photo() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'PILOT_IMAGE_FULL';
end;
$$;
revoke all on function gallery_internal.reject_oversized_photo() from public, anon, authenticated;

create trigger limit_cloud_photo
before insert or update of cloud_bytes, extension on public.works
for each row when (new.extension = 'webp' and new.cloud_bytes > 2000000)
execute function gallery_internal.reject_oversized_photo();

-- Storage may write metadata after creating the object. Enforce the final size
-- while allowing metadata-only updates to files published before this limit.
create function gallery_internal.check_storage_photo_size() returns trigger
language plpgsql set search_path = '' as $$
declare
  bytes bigint := coalesce((new.metadata->>'size')::bigint, 0);
  max_bytes integer := case when new.name like '%.preview.webp' then 65536 else 2000000 end;
begin
  if bytes <= max_bytes then return new; end if;
  if tg_op = 'UPDATE' and old.bucket_id = new.bucket_id and old.name = new.name
     and coalesce((old.metadata->>'size')::bigint, 0) >= bytes then return new; end if;
  raise exception 'PILOT_IMAGE_FULL';
end;
$$;
revoke all on function gallery_internal.check_storage_photo_size() from public, anon, authenticated;

create trigger limit_storage_photo
before insert or update of metadata, name, bucket_id on storage.objects
for each row when (new.bucket_id = 'gallery-art' and new.name like '%.webp')
execute function gallery_internal.check_storage_photo_size();
