import {t} from "./i18n.js";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { client } from "./backend.js";
async function invoke(body) {
  const { data, error } = await client.functions.invoke("gallery-passkeys", {
    body,
  });
  if (error) {
    let detail;
    try {
      detail = (await error.context?.json())?.error;
    } catch {}
    throw Error(detail || t("No se pudo conectar con el registro de Umbral."));
  }
  return data;
}
export async function authenticate(mode, label) {
  if (!browserSupportsWebAuthn())
    throw Error(
      t("Abrí Umbral en un navegador con llaves de acceso y conexión HTTPS."),
    );
  const { options, ticket } = await invoke({ step: "begin", mode, label });
  const credential =
    mode === "register"
      ? await startRegistration({ optionsJSON: options })
      : await startAuthentication({ optionsJSON: options });
  const { token_hash } = await invoke({ step: "finish", ticket, credential });
  const { data, error } = await client.auth.verifyOtp({
    token_hash,
    // A first-time identity receives a signup challenge; returning identities
    // receive a login challenge. Auth accepts both through the email OTP type.
    type: "email",
  });
  if (error) throw error;
  return data.user;
}
