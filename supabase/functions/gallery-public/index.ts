import { summaryFields, roomFields, disciplines } from "../_shared/catalog.js";

// This shared cache only reads RLS-filtered public data with the anonymous key.
const api = Deno.env.get("SUPABASE_URL")!,
  key = Deno.env.get("SUPABASE_ANON_KEY")!;
const ttl = 15000,
  capacity = 256;
const cache = new Map<string, { body: string; until: number }>(),
  pending = new Map<string, Promise<string>>();
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Retry-After, X-Gallery-Cache",
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function publicQuery(input: URLSearchParams) {
  const room = input.get("room"),
    category = input.get("category"),
    date = input.get("after"),
    id = input.get("id");
  if (room) {
    if (!uuid.test(room)) return null;
    return (
      "rooms?" +
      new URLSearchParams({
        select: roomFields,
        id: "eq." + room,
        published: "eq.true",
        "works.ready": "eq.true",
        limit: "1",
      })
    );
  }
  if (category && !disciplines.includes(category)) return null;
  const q = new URLSearchParams({
    select: summaryFields,
    order: "created_at.desc,id.asc",
    limit: "13",
  });
  if (category) q.set("category", "eq." + category);
  if (date || id) {
    if (
      !date ||
      !id ||
      !uuid.test(id) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(
        date,
      )
    )
      return null;
    q.set(
      "or",
      `(created_at.lt.${date},and(created_at.eq.${date},id.gt.${id}))`,
    );
  }
  return "gallery_catalog?" + q;
}
async function fill(query: string) {
  const r = await fetch(api + "/rest/v1/" + query, {
    headers: { apikey: key, Authorization: "Bearer " + key },
    signal: AbortSignal.timeout(4200),
  });
  if (!r.ok) throw Error("upstream");
  const body = await r.text();
  if (query.startsWith("rooms?") && body === "[]") return body;
  if (cache.size >= capacity) cache.delete(cache.keys().next().value!);
  cache.set(query, { body, until: Date.now() + ttl });
  return body;
}
Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers });
  const query = publicQuery(new URL(req.url).searchParams);
  if (!query) return new Response("null", { status: 400, headers });
  const hit = cache.get(query),
    usable = hit && hit.until > Date.now(),
    running = pending.get(query);
  const busy = () =>
    new Response("null", {
      status: 503,
      headers: { ...headers, "Cache-Control": "no-store", "Retry-After": "3" },
    });
  if (!usable && !running && pending.size >= 8) return busy();
  try {
    let body: string, remaining: number;
    if (usable) {
      body = hit.body;
      remaining = Math.floor((hit.until - Date.now()) / 1000);
    } else {
      const task = running || fill(query).finally(() => pending.delete(query));
      if (!running) pending.set(query, task);
      body = await task;
      remaining = query.startsWith("rooms?") && body === "[]" ? 0 : ttl / 1000;
    }
    return new Response(body, {
      headers: {
        ...headers,
        "Cache-Control": `public, max-age=${Math.max(0, remaining)}`,
        "X-Gallery-Cache": usable ? "hit" : running ? "joined" : "miss",
      },
    });
  } catch {
    return busy();
  }
});
