import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { localStack, serveStage, stageURL } from "./staging.mjs";
// This harness has no selectable remote target. It exercises only the local stack.
const stack = localStack(),
  headers = {
    apikey: stack.key,
    Authorization: "Bearer " + stack.key,
    "Content-Type": "application/json",
  };
const sql = (query) =>
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
    { input: query, stdio: ["pipe", "pipe", "pipe"] },
  );
const base = "/rest/v1/",
  url = (p) => stack.url + base + p;
const catalog = url(
  "gallery_catalog?select=id,title,artist,category,wall_color,cover_id&order=created_at.desc,id.asc&limit=13",
);
async function request(endpoint, body) {
  if (!["127.0.0.1"].includes(new URL(endpoint).hostname))
    throw Error("Destino externo rechazado");
  const response = await fetch(endpoint, {
    headers,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw Error(
      "HTTP " + response.status + " " + (await response.text()).slice(0, 140),
    );
  return response;
}
const rpc = async (name, body) =>
  (await request(url("rpc/" + name), body)).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const output = {
  created: new Date().toISOString(),
  environment: "Supabase Docker / loopback",
  catalogRows: 1024,
  worksPerRoom: 4,
  results: [],
  bodies: {},
};
function stats(name, vu, times, start, errors) {
  times.sort((a, b) => a - b);
  const elapsed = (performance.now() - start) / 1000;
  const at = (q) =>
    Math.round(times[Math.max(0, Math.ceil(times.length * q) - 1)] || 0);
  const row = {
    name,
    vu,
    ok: times.length,
    errors,
    elapsedSec: +elapsed.toFixed(2),
    rate: +(times.length / elapsed).toFixed(1),
    p50ms: at(0.5),
    p95ms: at(0.95),
    p99ms: at(0.99),
  };
  output.results.push(row);
  console.log(JSON.stringify(row));
}
async function run(name, n, rounds, op, ramp = 0) {
  const t = [],
    start = performance.now(),
    reasons = {};
  let errors = 0;
  await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      if (ramp) await sleep((i * ramp) / n);
      for (let k = 0; k < rounds; k++) {
        const at = performance.now();
        try {
          await op(i, k);
          t.push(performance.now() - at);
        } catch (e) {
          const reason = e.cause?.code || e.message;
          reasons[reason] = (reasons[reason] || 0) + 1;
          errors++;
        }
      }
    }),
  );
  stats(name, n, t, start, errors);
  output.results.at(-1).failureTypes = reasons;
  if (errors) console.log(reasons);
}
const seats = [],
  objects = [];
const galleryFiles = createClient(stack.url, stack.admin).storage.from(
  "gallery-art",
);
let server;
try {
  sql(`with fixture as (insert into auth.users(id,email) select gen_random_uuid(),'load-'||i||'@umbral-benchmark.invalid' from generate_series(1,1024) i where not exists(select 1 from auth.users where email='load-'||i||'@umbral-benchmark.invalid') returning id,email)
 insert into public.rooms(id,title,artist,category,published) select id,'Sala de carga '||split_part(email,'@',1),'Fixture de carga','Programación',true from fixture;
 insert into public.works(room_id,slot,title,extension,ready,source_name) select r.id,i,'Obra de prueba '||i,'txt',true,'demo.py' from public.rooms r cross join generate_series(1,4) i where r.artist='Fixture de carga' and not exists(select 1 from public.works w where w.room_id=r.id and w.slot=i);`);
  server = await serveStage();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
  const onlyArtist = process.argv.includes("--artist-only");
  const artist = await (
    await request(url("rooms?select=id&artist=eq.Fixture%20de%20carga&limit=1"))
  ).json();
  const room = artist[0].id;
  sql(
    "update public.works set extension='webp',source_name='foto.webp' where room_id='" +
      room +
      "'",
  );
  const works = await (
    await request(url("works?select=id&room_id=eq." + room + "&order=slot"))
  ).json();
  for (const [i, w] of works.entries()) {
    const key = room + "/" + w.id + ".webp",
      bytes = await readFile(
        "public/art/" +
          ["orbital", "frecuencia", "estratos", "intervalos"][i] +
          ".webp",
      );
    const { error } = await galleryFiles.upload(key, bytes, {
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw error;
    objects.push(key);
  }
  const scenarios = onlyArtist
    ? []
    : [
        ["catalog", stageURL],
        ["walk", stageURL + "?sala=orbital&modo=3d"],
      ];
  scenarios.push(["artist", stageURL + "?sala=" + room + "&modo=3d"]);
  const urls = {};
  for (const [name, loc] of scenarios) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 950 },
    });
    const seen = new Set();
    page.on("request", (r) => {
      if (
        r.url().startsWith(stageURL) ||
        (name === "artist" &&
          r.method() === "GET" &&
          r.url().startsWith(stack.url + "/"))
      )
        seen.add(r.url());
    });
    await page.goto(loc);
    await page.waitForSelector(
      name === "catalog" ? ".card" : "#viewport canvas",
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    urls[name] = [...seen];
    await page.close();
    let size = 0,
      storageBytes = 0,
      storageCount = 0;
    for (const endpoint of seen) {
      const r = await request(endpoint);
      const body = await r.arrayBuffer();
      const bytes = Number(r.headers.get("content-length")) || body.byteLength;
      size += bytes;
      if (endpoint.includes("/storage/v1/object/public/")) {
        storageBytes += bytes;
        storageCount++;
      }
    }
    output.bodies[name] = {
      bytes: size,
      requests: seen.size,
      storageBytes,
      storageCount,
    };
    if (name === "artist" && storageCount !== 4)
      throw Error(
        "Las cuatro imágenes de la sala deben formar parte de la carga.",
      );
  }
  await browser.close();
  await request(catalog).then((r) => r.arrayBuffer());
  if (!onlyArtist)
    for (const n of [25, 100, 250, 1000])
      await run("catalog-api", n, n === 1000 ? 1 : 3, async () => {
        const r = await request(catalog);
        if ((await r.json()).length !== 13) throw Error("Página incompleta");
      });
  for (const name of Object.keys(urls)) {
    for (const n of [100, 500, 1000])
      await run(name + "-cold", n, 1, async () => {
        // Each visitor fetches the same cold resource set from the compressed, local origin.
        for (const endpoint of urls[name])
          await (await request(endpoint)).arrayBuffer();
        if (name === "catalog") await (await request(catalog)).arrayBuffer();
      });
  }
  for (const name of Object.keys(urls))
    await run(
      name + "-30s-arrivals",
      1000,
      1,
      async () => {
        for (const endpoint of urls[name])
          await (await request(endpoint)).arrayBuffer();
        if (name === "catalog") await (await request(catalog)).arrayBuffer();
      },
      30000,
    );
  if (!onlyArtist) {
    let denied = 0;
    await run("social-admission", 160, 1, async () => {
      const s = await rpc("join_gallery_visit", { room_key: "patio" });
      if (s) seats.push(s);
      else denied++;
    });
    output.social = {
      admitted: seats.length,
      denied,
      groups: new Set(seats.map((s) => s.instance)).size,
    };
    if (seats.length !== 120 || denied !== 40)
      throw Error("Cupo local inesperado");
    const t = [],
      start = performance.now();
    let errors = 0;
    await Promise.all(
      seats.map(async (s, i) => {
        await sleep(i * 8);
        for (let j = 0; j < 22; j++) {
          const now = performance.now();
          try {
            const data = await rpc("gallery_snapshot", {
              lease: s.ticket,
              px: Math.sin(j),
              pz: Math.cos(j),
              angle: j,
              since_id: 0,
            });
            if (data?.peers.length !== 6) throw Error("Grupo incompleto");
            t.push(performance.now() - now);
          } catch {
            errors++;
          }
          await sleep(Math.max(0, 1300 - (performance.now() - now)));
        }
      }),
    );
    stats("social-moving", 120, t, start, errors);
  }
  await mkdir(".qa", { recursive: true });
  await writeFile(
    onlyArtist ? ".qa/artist-results.json" : ".qa/load-results.json",
    JSON.stringify(output, null, 2),
  );
  console.log(JSON.stringify(output.bodies), JSON.stringify(output.social));
} finally {
  await Promise.allSettled(
    seats.map((s) => rpc("leave_gallery_visit", { lease: s.ticket })),
  );
  server?.close();
  if (objects.length) await galleryFiles.remove(objects);
  sql(
    "delete from auth.users where email ~ '^load-[0-9]+@umbral-benchmark\\.invalid$' and exists(select 1 from public.rooms where id=auth.users.id and artist='Fixture de carga');",
  );
}
