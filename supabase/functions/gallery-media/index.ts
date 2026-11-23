import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const origin = Deno.env.get("GALLERY_ORIGIN") || "https://luzbel33.github.io";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), {
    status,
    headers,
  });
const types: Record<string, string> = {
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  webp: "image/webp",
  txt: "text/plain",
  mesh: "application/octet-stream",
};
const chunkSize = 6 * 1024 ** 2;
const fields =
  "id,room_id,extension,cloud_bytes,preview_bytes,cloud_url,preview_url,ready";
const credentials = Deno.env.get("CLOUDINARY_URL");
const cloud = credentials ? new URL(credentials) : null;

async function provider(
  type: string,
  action: string,
  parameters: Record<string, string>,
  file?: Blob,
  extra?: Record<string, string>,
) {
  if (!cloud) throw Error("unconfigured");
  parameters.timestamp = String(Math.floor(Date.now() / 1000));
  const signed =
    Object.keys(parameters)
      .sort()
      .map((k) => k + "=" + parameters[k])
      .join("&") + decodeURIComponent(cloud.password);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(signed),
  );
  const data = new FormData();
  for (const [key, value] of Object.entries(parameters))
    data.append(key, value);
  data.append("api_key", decodeURIComponent(cloud.username));
  data.append(
    "signature",
    Array.from(new Uint8Array(hash), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join(""),
  );
  if (file) data.append("file", file, "asset");
  const response = await fetch(
    "https://api.cloudinary.com/v1_1/" +
      cloud.hostname +
      "/" +
      type +
      "/" +
      action,
    {
      method: "POST",
      body: data,
      headers: extra,
      signal: AbortSignal.timeout(50000),
    },
  );
  if (!response.ok) {
    console.warn("Cloudinary", action, type, response.status);
    throw Error("provider");
  }
  return await response.json();
}

async function boundedBody(req: Request, length: number) {
  if (
    (req.headers.has("content-length") &&
      Number(req.headers.get("content-length")) !== length) ||
    !req.body
  )
    throw Error("size");
  const reader = req.body.getReader(),
    bytes = new Uint8Array(length);
  let at = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (at + value.length > length) {
      await reader.cancel();
      throw Error("size");
    }
    bytes.set(value, at);
    at += value.length;
  }
  if (at !== length) throw Error("size");
  return bytes;
}

Deno.serve(async (req) => {
  if (req.headers.get("origin") !== origin) return reply(403, "origin");
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST" || !cloud) return reply(503, "MEDIA_UNAVAILABLE");
  const { searchParams: q } = new URL(req.url);
  const work = q.get("work"),
    op = q.get("op"),
    preview = q.get("preview") === "1";
  if (
    !work ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(work) ||
    !["upload", "delete"].includes(op || "")
  )
    return reply(400, "input");
  const jwt = (req.headers.get("authorization") || "").match(
    /^Bearer (.+)$/i,
  )?.[1];
  if (!jwt) return reply(401, "account");
  const { data: auth, error: authError } = await db.auth.getUser(jwt);
  if (authError || !auth.user) return reply(401, "account");
  const owner = auth.user.id,
    lease = crypto.randomUUID();
  const locked = await db.rpc("lock_gallery_media", {
    owner_key: owner,
    work_key: work,
    lease,
  });
  if (locked.error) return reply(503, "MEDIA_UNAVAILABLE");
  if (!locked.data) {
    // A repeated delete after a lost success response is already complete.
    if (op === "delete") {
      const lookup = await db
        .from("works")
        .select("id")
        .eq("id", work)
        .eq("room_id", owner)
        .maybeSingle();
      if (!lookup.error && !lookup.data) return reply(200);
    }
    return reply(409, "MEDIA_BUSY");
  }
  try {
    const { data: w, error } = await db
      .from("works")
      .select(fields)
      .eq("id", work)
      .eq("room_id", owner)
      .single();
    if (error || !w) return reply(404, "work");
    const type =
      w.extension === "webp"
        ? "image"
        : ["mesh", "txt"].includes(w.extension)
          ? "raw"
          : "video";
    const base = "umbral/" + owner + "/" + work,
      mainId = base + (type === "raw" ? "." + w.extension : "");
    if (op === "delete") {
      const remove = async (kind: string, id: string) => {
        const r = await provider(kind, "destroy", {
          public_id: id,
          invalidate: "true",
        });
        if (!["ok", "not found"].includes(r.result)) throw Error("provider");
      };
      await remove(type, mainId);
      if (w.preview_bytes) await remove("image", base + "-preview");
      const d = await db
        .from("works")
        .delete()
        .eq("id", work)
        .eq("room_id", owner);
      if (d.error) throw d.error;
      return reply(200);
    }
    const total = preview ? w.preview_bytes : w.cloud_bytes;
    if (!total || (preview && w.extension !== "webp"))
      return reply(400, "input");
    if (preview ? w.preview_url : w.cloud_url) return reply(200);
    const offset = Number(q.get("offset") || 0);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset >= total ||
      offset % chunkSize !== 0
    )
      return reply(400, "size");
    const length = Math.min(chunkSize, total - offset),
      last = offset + length === total;
    const bytes = await boundedBody(req, length);
    const resourceType = preview ? "image" : type,
      id = preview ? base + "-preview" : mainId;
    const partHeaders =
      total > chunkSize
        ? {
            "X-Unique-Upload-Id": work + (preview ? "-preview" : ""),
            "Content-Range":
              "bytes " + offset + "-" + (offset + length - 1) + "/" + total,
          }
        : undefined;
    const result = await provider(
      resourceType,
      "upload",
      { public_id: id, overwrite: "false", backup: "false" },
      new Blob([bytes], { type: types[preview ? "webp" : w.extension] }),
      partHeaders,
    );
    if (!last) return reply(200);
    if (
      result.public_id !== id ||
      result.resource_type !== resourceType ||
      result.bytes !== total ||
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith(
        "https://res.cloudinary.com/" +
          cloud.hostname +
          "/" +
          resourceType +
          "/upload/",
      )
    )
      throw Error("metadata");
    const updates = preview
      ? { preview_url: result.secure_url, ready: !!w.cloud_url }
      : {
          cloud_url: result.secure_url,
          ready: !w.preview_bytes || !!w.preview_url,
        };
    const saved = await db
      .from("works")
      .update(updates)
      .eq("id", work)
      .eq("room_id", owner);
    if (saved.error) throw saved.error;
    return reply(200);
  } catch (e) {
    if (e instanceof Error && e.message === "size") return reply(400, "size");
    return reply(502, "MEDIA_UNAVAILABLE");
  } finally {
    await db.rpc("unlock_gallery_media", { work_key: work, lease });
  }
});
