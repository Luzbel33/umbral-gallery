import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13.2.2";

const origin = Deno.env.get("GALLERY_ORIGIN") || "https://luzbel33.github.io";
const rpID = new URL(origin).hostname;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const encode = (v: Uint8Array) =>
  btoa(String.fromCharCode(...v))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode = (v: string) =>
  Uint8Array.from(atob(v.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
const bytes = new TextEncoder();
const mac = crypto.subtle.importKey(
  "raw",
  bytes.encode("umbral/webauthn/v1/" + secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { headers, status });
type Ticket = {
  id: string;
  expires: number;
  mode: string;
  challenge: string;
  label: string;
};
async function claim(ticket: Ticket) {
  const row = {
    id: ticket.id,
    expires_at: new Date(ticket.expires).toISOString(),
  };
  const { error } = await db.from("gallery_ceremonies").insert(row);
  if (error) throw Error("La solicitud ya venció. Volvé a intentarlo.");
  await db
    .from("gallery_ceremonies")
    .delete()
    .lt("expires_at", new Date().toISOString());
}
Deno.serve(async (req) => {
  if (req.headers.get("origin") !== origin)
    return response({ error: "Origen inválido." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { headers, status: 204 });
  if (req.method !== "POST")
    return response({ error: "Método inválido." }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 36000) throw Error("Solicitud demasiado grande.");
    const body = JSON.parse(raw);
    if (body.step === "begin") {
      if (!["register", "login"].includes(body.mode))
        throw Error("Solicitud inválida.");
      const label =
        String(body.label || "Artista")
          .trim()
          .slice(0, 48) || "Artista";
      const options =
        body.mode === "register"
          ? await generateRegistrationOptions({
              rpName: "Umbral",
              rpID,
              userName: label,
              userDisplayName: label,
              attestationType: "none",
              authenticatorSelection: {
                residentKey: "required",
                userVerification: "required",
              },
            })
          : await generateAuthenticationOptions({
              rpID,
              userVerification: "required",
            });
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        expires: Date.now() + 180000,
        mode: body.mode,
        challenge: options.challenge,
        label,
      };
      const payload = encode(bytes.encode(JSON.stringify(ticket)));
      const signature = encode(
        new Uint8Array(
          await crypto.subtle.sign("HMAC", await mac, bytes.encode(payload)),
        ),
      );
      return response({ options, ticket: payload + "." + signature });
    }
    if (body.step !== "finish" || typeof body.ticket !== "string")
      throw Error("Solicitud inválida.");
    const [payload, signature] = body.ticket.split(".");
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await mac,
        decode(signature),
        bytes.encode(payload),
      ))
    )
      throw Error("Solicitud inválida.");
    const ticket: Ticket = JSON.parse(
      new TextDecoder().decode(decode(payload)),
    );
    if (ticket.expires < Date.now())
      throw Error("La solicitud venció. Volvé a intentarlo.");
    const checks = {
      expectedChallenge: ticket.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    };
    let identity: string, label: string;
    if (ticket.mode === "register") {
      const result = await verifyRegistrationResponse({
        ...checks,
        response: body.credential,
      });
      if (!result.verified || !result.registrationInfo)
        throw Error("No se pudo verificar la llave.");
      await claim(ticket);
      const c = result.registrationInfo.credential;
      const { data, error } = await db
        .from("gallery_passkeys")
        .insert({
          credential_id: c.id,
          public_key: encode(c.publicKey),
          sign_count: c.counter,
          label: ticket.label,
        })
        .select("identity,label")
        .single();
      if (error)
        throw Error("No se pudo registrar la llave. Probá ingresar con ella.");
      ({ identity, label } = data);
    } else {
      const { data: p, error } = await db
        .from("gallery_passkeys")
        .select("*")
        .eq("credential_id", body.credential.id)
        .single();
      if (error || !p) throw Error("Esta llave no está registrada en Umbral.");
      const result = await verifyAuthenticationResponse({
        ...checks,
        response: body.credential,
        credential: {
          id: p.credential_id,
          publicKey: decode(p.public_key),
          counter: p.sign_count,
        },
      });
      if (!result.verified) throw Error("No se pudo verificar la llave.");
      await claim(ticket);
      if (result.authenticationInfo.newCounter > p.sign_count) {
        const saved = await db
          .from("gallery_passkeys")
          .update({ sign_count: result.authenticationInfo.newCounter })
          .eq("credential_id", p.credential_id)
          .eq("sign_count", p.sign_count)
          .select("credential_id")
          .single();
        if (saved.error) throw Error("Volvé a ingresar con tu llave.");
      }
      ({ identity, label } = p);
    }
    // An opaque internal identifier binds a verified passkey to its Auth user.
    // The artist never supplies an email or receives an unverified email identity.
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: identity + "@accounts.umbral.invalid",
      options: { data: { artist: label } },
    });
    if (error) throw Error("No se pudo abrir la sesión de la galería.");
    return response({ token_hash: data.properties.hashed_token });
  } catch (e) {
    const safe = [
      "La solicitud",
      "Solicitud",
      "La llave",
      "Esta llave",
      "No se pudo",
      "Volvé",
      "Origen",
    ];
    const message =
      e instanceof Error && safe.some((s) => e.message.startsWith(s))
        ? e.message
        : "La llave no se pudo verificar. Volvé a intentarlo.";
    return response({ error: message }, 400);
  }
});
