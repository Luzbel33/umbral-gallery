import { t } from "./i18n.js";
import { icon } from "./icons.js";
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const $ = (s, p = document) => p.querySelector(s);
export const dialog = $("#panel");
export function panel(title, body, kind = "") {
  if (document.pointerLockElement) document.exitPointerLock();
  pauseMedia();
  dialog.className = kind;
  $("#panel-inner").innerHTML =
    `<div class="panel-heading"><h2 id="panel-title">${esc(title)}</h2><button class="round" data-close aria-label="${t("Cerrar")}">${icon("close")}</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
}
export function pauseMedia() {
  dialog.querySelectorAll("audio,video").forEach((el) => el.pause());
}
export function toast(message) {
  const n = $("#toast");
  n.textContent = message;
  n.classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => n.classList.remove("on"), 3100);
}
export function failure(e) {
  if (e?.name === "NotAllowedError" || e?.code === "ERROR_CEREMONY_ABORTED")
    return t("Se canceló la llave de acceso. Podés volver a intentarlo.");
  const message = String(e?.message || "");
  const limits = {
    MEDIA_BUSY:
      "Hay otra operación en curso sobre esta obra. Volvé a intentar en un momento.",
    MEDIA_UNAVAILABLE:
      "No se completó la transferencia de la obra. Volvé a intentar.",
    MEDIA_ACCOUNT: "Ingresá para editar tu sala.",
    DOCUMENT_BYTES_FULL:
      "El archivo supera el espacio disponible en el almacenamiento de documentos.",
    PILOT_ARTISTS_FULL:
      "Las 100 salas del piloto ya tienen artista. Podés seguir visitando y guardando favoritos.",
    PILOT_WORKS_FULL:
      "Tu sala admite cuatro obras. Retirá una para subir otra.",
    PILOT_BYTES_FULL:
      "Este archivo supera el espacio disponible. Elegí un archivo más liviano, retirá una obra o usá un enlace.",
  };
  for (const [key, copy] of Object.entries(limits))
    if (message.includes(key)) return t(copy);
  return t(e?.message) || t("No se pudo completar. Volvé a intentarlo.");
}
export function media(w, thumbnail = false) {
  if (!["image", "audio", "video"].includes(w.type)) return "";
  if (w.type === "image")
    return `<img class="piece-image" src="${esc((thumbnail && w.preview) || w.url)}" alt="${esc(w.title)}" loading="lazy" decoding="async">`;
  if (w.type === "audio")
    return `<div class="sound-work"><div class="sound-face">${icon("headphones", 23)}<canvas width="320" height="68" aria-hidden="true"></canvas></div><audio crossorigin="anonymous" controls preload="none" src="${esc(w.url)}" aria-label="${esc(w.title)}"></audio></div>`;
  return `<${w.type} controls preload="none" ${w.type === "video" ? "playsinline" : ""} src="${esc(w.url)}" aria-label="${esc(w.title)}"></${w.type}>`;
}
export function fallback(r) {
  return `<div class="room-art" style="--room:${/^#[a-f0-9]{6}$/i.test(r.wall_color) ? r.wall_color : "#8b847d"}"><i></i><b></b><span></span></div>`;
}
