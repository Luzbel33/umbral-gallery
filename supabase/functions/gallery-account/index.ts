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
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const send = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
const hex = (v: Uint8Array) =>
  Array.from(v, (x) => x.toString(16).padStart(2, "0")).join("");
const digest = async (v: string) =>
  hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    ),
  );
Deno.serve(async (req) => {
  if (req.headers.get("origin") !== origin)
    return send({ error: "origin" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return send({ error: "method" }, 405);
  try {
    const reader = req.body?.getReader();
    if (!reader) return send({ error: "input" }, 400);
    const bytes = new Uint8Array(2048);
    let length = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) {
        await reader.cancel();
        return send({ error: "input" }, 413);
      }
      bytes.set(value, length);
      length += value.length;
    }
    const { action, handle, password, code } = JSON.parse(
      new TextDecoder().decode(bytes.subarray(0, length)),
    );
    if (
      !["register", "recover"].includes(action) ||
      typeof handle !== "string" ||
      !/^[a-z0-9_]{3,24}$/.test(handle) ||
      typeof password !== "string" ||
      password.length < 10 ||
      new TextEncoder().encode(password).length > 72
    )
      return send({ error: "input" }, 400);
    const addr =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: allowed, error: rateError } = await db.rpc(
      "gallery_account_budget",
      {
        network_hash: await digest(
          new Date().toISOString().slice(0, 10) + "|" + addr,
        ),
      },
    );
    if (rateError) return send({ error: "unavailable" }, 503);
    if (!allowed) return send({ error: "rate" }, 429);
    const email = handle + "@members.umbral.invalid";
    if (action === "register") {
      const backup = hex(crypto.getRandomValues(new Uint8Array(16)));
      const { error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { artist: handle },
        app_metadata: {
          umbral_handle: handle,
          umbral_backup: await digest(backup),
        },
      });
      if (error)
        return ["email_exists", "user_already_exists"].includes(
          error.code || "",
        )
          ? send({ error: "taken" }, 409)
          : send({ error: "unavailable" }, 503);
      return send({ backup });
    }
    if (typeof code !== "string" || !/^[0-9a-f]{32}$/.test(code))
      return send({ error: "recovery" }, 400);
    const { data: id, error } = await db.rpc("gallery_recovery_user", {
      member_email: email,
      recovery_digest: await digest(code),
    });
    if (error) return send({ error: "unavailable" }, 503);
    if (!id) return send({ error: "recovery" }, 400);
    const changed = await db.auth.admin.updateUserById(id, { password });
    return changed.error
      ? send({ error: "unavailable" }, 503)
      : send({ ok: true });
  } catch {
    return send({ error: "input" }, 400);
  }
});
