import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { localStack } from "./staging.mjs";
const stack = localStack();
const admin = createClient(stack.url, stack.admin, {
  auth: { persistSession: false },
});
const sql = `begin;
do $$
declare owner_id uuid; ids uuid[]:='{}'; count_before int; i int; mib bigint:=1048576;
begin
 select count(*) into count_before from public.rooms;
 for i in 1..100-count_before loop
  owner_id:=gen_random_uuid();insert into auth.users(id,email) values(owner_id,owner_id||'@local-test.invalid');
  insert into public.rooms(id,artist) values(owner_id,'Capacity fixture');ids:=array_append(ids,owner_id);
 end loop;
 begin
  owner_id:=gen_random_uuid();insert into auth.users(id,email) values(owner_id,owner_id||'@local-test.invalid');
  insert into public.rooms(id,artist) values(owner_id,'Extra fixture');
  raise exception 'Unexpected extra room';
 exception when raise_exception then if sqlerrm<>'PILOT_ARTISTS_FULL' then raise;end if;end;
 if cardinality(ids)<6 then raise exception 'Use a dedicated empty test database';end if;
 for i in 1..5 loop
  insert into storage.objects(bucket_id,name,metadata) values('gallery-art',ids[i]||'/one',jsonb_build_object('size',24*mib));
  insert into storage.objects(bucket_id,name,metadata) values('gallery-art',ids[i]||'/two',jsonb_build_object('size',(case when i=5 then 14 else 24 end)*mib));
 end loop;
 insert into storage.objects(bucket_id,name,metadata) values('gallery-art',ids[6]||'/reserve',jsonb_build_object('size',6*mib));
 begin
  insert into storage.objects(bucket_id,name,metadata) values('gallery-art',ids[6]||'/excess',jsonb_build_object('size',1));
  raise exception 'Unexpected extra byte';
 exception when raise_exception then if sqlerrm<>'PILOT_BYTES_FULL' then raise;end if; end;
 -- With Cloudinary enabled, every artist can occupy 48 MiB in the same transaction.
 perform set_config('storage.allow_delete_query','true',true);
 delete from storage.objects where bucket_id='gallery-art' and split_part(name,'/',1)=any(ids::text[]);
 update gallery_internal.media_rollout set enabled=true;
 foreach owner_id in array ids loop
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.reserve_gallery_upload(gen_random_uuid(),'First','first.mp4','mp4',(32*mib)::int,0);
  perform public.reserve_gallery_upload(gen_random_uuid(),'Second','second.mp3','mp3',(16*mib)::int,0);
  if (public.my_gallery_budget()->>'available')::bigint<>0 then raise exception 'Room was not filled';end if;
  begin
    perform public.reserve_gallery_upload(gen_random_uuid(),'Overflow','overflow.mp3','mp3',1,0);
    raise exception 'Unexpected extra byte';
  exception when raise_exception then if sqlerrm<>'PILOT_BYTES_FULL' then raise;end if;end;
 end loop;
end $$;rollback;`;
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_umbral-gallery",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    "postgres",
  ],
  { input: sql, stdio: ["pipe", "pipe", "inherit"] },
);
console.log(
  "PASS room 101 denied, legacy pool protected and all fixture rooms reserve 48 MiB together on Cloudinary",
);
const password = randomBytes(20).toString("hex"),
  email = randomUUID() + "@quota-check.invalid";
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw error;
const id = data.user.id,
  user = createClient(stack.url, stack.key, {
    auth: { persistSession: false },
  }),
  paths = [];
try {
  const auth = await user.auth.signInWithPassword({ email, password });
  if (auth.error) throw auth.error;
  const room = await user.rpc("create_my_gallery", { ui_language: "en" });
  if (room.error) throw room.error;
  for (let i = 1; i <= 2; i++) {
    const work = randomUUID();
    const r = await user.from("works").insert({
      id: work,
      room_id: id,
      slot: i,
      extension: "mp3",
      title: "Storage fixture",
    });
    if (r.error) throw r.error;
    paths.push(id + "/" + work + ".mp3");
  }
  const buf = new Uint8Array(25 * 1024 ** 2);
  const outcomes = await Promise.all(
    paths.map((p) =>
      user.storage
        .from("gallery-art")
        .upload(p, buf, { contentType: "audio/mpeg" }),
    ),
  );
  assert.equal(outcomes.filter((x) => !x.error).length, 1);
  const budget = await user.rpc("my_gallery_budget");
  if (budget.error) throw budget.error;
  assert.equal(budget.data.used, buf.length);
  assert.equal(budget.data.available, 23 * 1024 ** 2);
  const link = await user.rpc("add_gallery_link", {
    work_title: "Linked film",
    provider: "vimeo",
    work_url: "https://vimeo.com/76979871",
  });
  if (link.error) throw link.error;
  assert.equal((await user.rpc("my_gallery_budget")).data.used, buf.length);
  const probe = await admin.rpc("probe_gallery_media", { owner_key: id });
  if (probe.error) throw probe.error;
  const reservations = await Promise.all(
    [1, 2].map((n) =>
      user.rpc("reserve_gallery_upload", {
        work_key: randomUUID(),
        work_title: "Concurrent " + n,
        filename: "test.mp4",
        ext: "mp4",
        bytes: 16 * 1024 ** 2,
        thumb: 0,
      }),
    ),
  );
  assert.equal(reservations.filter((r) => !r.error).length, 1);
  assert.match(
    reservations.find((r) => r.error).error.message,
    /PILOT_BYTES_FULL/,
  );
  assert.equal(
    (await user.rpc("my_gallery_budget")).data.available,
    7 * 1024 ** 2,
  );
  console.log(
    "PASS concurrent Cloudinary reservations count both existing files and pending bytes",
  );
  console.log(
    "PASS concurrent Storage uploads enforce the 48 MiB room limit; a linked work consumes no file storage",
  );
} finally {
  const d = await admin.storage.from("gallery-art").remove(paths);
  if (d.error) throw d.error;
  const u = await admin.auth.admin.deleteUser(id);
  if (u.error) throw u.error;
}
