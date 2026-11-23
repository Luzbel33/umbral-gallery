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
  "PASS 100th room accepted, 101st denied, protected reserve and 200 MiB shared pool",
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
    const r = await user
      .from("works")
      .insert({
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
  console.log(
    "PASS concurrent Storage uploads enforce the 48 MiB room limit; a linked work consumes no file storage",
  );
} finally {
  const d = await admin.storage.from("gallery-art").remove(paths);
  if (d.error) throw d.error;
  const u = await admin.auth.admin.deleteUser(id);
  if (u.error) throw u.error;
}
