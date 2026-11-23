import { t } from "./i18n.js";
import { client } from "./backend.js";
import { $, dialog, panel, failure } from "./ui.js";
import { icon } from "./icons.js";

const messages = {
  taken: "Ese usuario ya está en uso. Elegí otro o iniciá sesión.",
  rate: "Hubo varios intentos. Volvé a probar en diez minutos.",
  recovery: "Revisá el usuario y el código de recuperación.",
  input: "Revisá el usuario y la contraseña.",
  unavailable: "No pudimos conectar con tu cuenta. Probá de nuevo.",
};
async function accountRequest(body) {
  const { data, error } = await client.functions.invoke("gallery-account", {
    body,
  });
  if (!error) return data;
  let key;
  try {
    key = (await error.context.json()).error;
  } catch {}
  throw Error(t(messages[key] || messages.unavailable));
}
function backupPanel(handle, code, finish) {
  const grouped = code.match(/.{4}/g).join("-");
  panel(
    t("Tu cuenta está lista"),
    `<p>${t("Guardá este código para recuperar tu cuenta si olvidás la contraseña.")}</p><div class="backup-code"><code>${grouped}</code></div><div class="row"><button class="primary" id="account-done">${t("Continuar")}</button><button id="download-backup" class="secondary">${t("Descargar código")}</button></div>`,
    "account-panel",
  );
  $("#download-backup").onclick = () => {
    const link = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob(
          [
            `Umbral\n${t("Usuario")}: ${handle}\n${t("Código de recuperación")}: ${grouped}\n`,
          ],
          { type: "text/plain" },
        ),
      );
    link.href = url;
    link.download = "umbral-" + handle + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("#account-done").onclick = finish;
}
export function showAccount(mode, signedIn, exhibit = false) {
  const register = mode === "register",
    recover = mode === "recover";
  const title = t(
    register
      ? "Crear cuenta"
      : recover
        ? "Recuperar mi cuenta"
        : "Iniciar sesión",
  );
  const userHint = t("De 3 a 24 letras sin tildes, números o guion bajo.");
  panel(
    title,
    `<p class="account-intro">${register ? t(exhibit ? "Creá tu cuenta para preparar tu primera exposición." : "Con una cuenta podés guardar salas y participar en el chat. Exponer es opcional.") : recover ? t("Usá el código que guardaste al crear tu cuenta y elegí una contraseña nueva.") : t("Ingresá con el usuario y la contraseña que elegiste.")}</p>
    <form id="auth-form"><label>${t("Usuario")}<input name="handle" aria-label="${t("Usuario")}" ${register ? 'aria-describedby="handle-hint"' : ""} autocapitalize="none" spellcheck="false" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="luna_sur" title="${userHint}">${register ? `<small id="handle-hint">${userHint}</small>` : ""}</label>
    ${recover ? `<label>${t("Código de recuperación")}<input name="backup" required autocomplete="off" spellcheck="false" maxlength="48"></label>` : ""}
    <label>${t(recover ? "Contraseña nueva" : "Contraseña")}<span class="password-field"><input name="password" type="password" autocomplete="${register || recover ? "new-password" : "current-password"}" required ${register || recover ? 'minlength="10"' : ""}><button type="button" class="reveal-password" aria-label="${t("Mostrar contraseña")}" aria-pressed="false">${icon("eye", 19)}</button></span>${register || recover ? `<small>${t("Usá al menos 10 caracteres.")}</small>` : ""}</label>
    <p class="form-status" role="status"></p><button class="primary" type="submit">${recover ? t("Guardar contraseña") : title} ${icon("arrow", 17)}</button></form>
    <div class="account-actions"><button class="text-btn switch">${t(register ? "Ya tengo una cuenta" : recover ? "Volver al ingreso" : "Crear una cuenta")}</button>${!register && !recover ? `<button class="text-btn" data-recover>${t("Olvidé mi contraseña")}</button>` : ""}</div>
    ${!register && !recover ? `<details class="legacy-access"><summary>${t("Me registré antes con mi dispositivo")}</summary><button class="secondary" data-passkey>${t("Entrar con mi acceso anterior")}</button></details>` : ""}
    ${register ? `<a data-nav class="example-link" href="?sala=taller">${t("Ver una sala de ejemplo")} ${icon("external", 15)}</a>` : ""}`,
    "account-panel",
  );
  const form = $("#auth-form"),
    status = $(".form-status", form),
    submit = $("[type=submit]", form);
  $(".switch").onclick = () =>
    showAccount(register || recover ? "login" : "register", signedIn, exhibit);
  const recovery = $("[data-recover]");
  if (recovery)
    recovery.onclick = () => showAccount("recover", signedIn, exhibit);
  $(".reveal-password").onclick = (e) => {
    const reveal = form.elements.password.type === "password";
    form.elements.password.type = reveal ? "text" : "password";
    e.currentTarget.setAttribute("aria-pressed", String(reveal));
    e.currentTarget.setAttribute(
      "aria-label",
      t(reveal ? "Ocultar contraseña" : "Mostrar contraseña"),
    );
  };
  const old = $("[data-passkey]");
  if (old)
    old.onclick = async () => {
      old.disabled = true;
      try {
        const { authenticate } = await import("./passkeys.js");
        const person = await authenticate("login");
        await signedIn(person);
      } catch (e) {
        status.textContent = failure(e);
        old.disabled = false;
      }
    };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = t("Un momento…");
    const handle = form.elements.handle.value.trim().toLowerCase(),
      password = form.elements.password.value;
    let created;
    try {
      if (
        (register || recover) &&
        new TextEncoder().encode(password).length > 72
      )
        throw Error(t("Usá una contraseña de hasta 72 bytes."));
      if (register)
        created = await accountRequest({
          action: "register",
          handle,
          password,
        });
      if (recover)
        await accountRequest({
          action: "recover",
          handle,
          password,
          code: form.elements.backup.value.toLowerCase().replace(/[\s-]/g, ""),
        });
      const { data, error } = await client.auth.signInWithPassword({
        email: handle + "@members.umbral.invalid",
        password,
      });
      if (error && created && form.isConnected && dialog.open) {
        backupPanel(handle, created.backup, () =>
          showAccount("login", signedIn, exhibit),
        );
        return;
      }
      if (error)
        throw Error(
          t(
            error.code === "invalid_credentials"
              ? "El usuario o la contraseña son incorrectos."
              : messages.unavailable,
          ),
        );
      const finish = () => signedIn(data.user);
      if (created && form.isConnected && dialog.open)
        backupPanel(handle, created.backup, finish);
      else await finish();
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      submit.disabled = false;
    }
  };
}
