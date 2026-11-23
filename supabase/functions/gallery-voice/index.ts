const origin = Deno.env.get("GALLERY_ORIGIN") || "https://luzbel33.github.io";
const url = Deno.env.get("SUPABASE_URL")!;
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const result = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), {
    headers,
    status,
  });
Deno.serve(async (req) => {
  if (req.headers.get("origin") !== origin)
    return result(403, "Origen no permitido.");
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return result(405, "Método no permitido.");
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return result(401, "Ingresá para hablar.");
  try {
    if (!req.body) return result(400, "Falta el fragmento.");
    const reader = req.body.getReader(),
      body = new Uint8Array(9200);
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size + value.length > body.length) {
          await reader.cancel();
          return result(413, "Fragmento demasiado largo.");
        }
        body.set(value, size);
        size += value.length;
      }
    } finally {
      reader.releaseLock();
    }
    const raw = new TextDecoder().decode(body.subarray(0, size));
    const { lease, audio } = JSON.parse(raw);
    if (
      typeof lease !== "string" ||
      lease.length !== 36 ||
      typeof audio !== "string" ||
      audio.length < 4 ||
      audio.length > 8540 ||
      audio.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)
    )
      return result(400, "Fragmento inválido.");
    const check = await fetch(url + "/rest/v1/rpc/gallery_voice_packet", {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lease, encoded_length: audio.length }),
    });
    if (!check.ok) return result(429, "El turno o el cupo de voz se agotó.");
    const route = await check.json();
    if (!route) return result(409, "El turno de voz terminó.");
    if (route.topics.length) {
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sent = await fetch(url + "/realtime/v1/api/broadcast", {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: route.topics.map((topic: string) => ({
            topic,
            private: true,
            event: "audio",
            payload: { from: route.peer, nick: route.nick, audio },
          })),
        }),
      });
      if (!sent.ok) return result(502, "El canal de voz se interrumpió.");
    }
    return result(200);
  } catch {
    return result(400, "No se pudo transmitir el fragmento.");
  }
});
