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
  pauseMedia();
  dialog.className = kind;
  $("#panel-inner").innerHTML =
    `<div class="panel-heading"><h2 id="panel-title">${esc(title)}</h2><button class="round" data-close aria-label="Cerrar">${icon("close")}</button></div>${body}`;
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
    return "Se canceló la llave de acceso. Podés volver a intentarlo.";
  return e?.message || "No se pudo completar. Volvé a intentarlo.";
}
export function media(w) {
  if (!["image", "audio", "video"].includes(w.type)) return "";
  if (w.type === "image")
    return `<img class="piece-image" src="${esc(w.url)}" alt="${esc(w.title)}" loading="lazy" decoding="async">`;
  return `<${w.type} controls preload="none" ${w.type === "video" ? "playsinline" : ""} src="${esc(w.url)}" aria-label="${esc(w.title)}"></${w.type}>`;
}
export function fallback(r) {
  return `<div class="room-art" style="--room:${/^#[a-f0-9]{6}$/i.test(r.wall_color) ? r.wall_color : "#8b847d"}"><i></i><b></b><span></span></div>`;
}
