import { t } from "./i18n.js";
import { $, esc, failure } from "./ui.js";
import { icon } from "./icons.js";
import { credit } from "./profile.js";
import { art, recordings } from "./catalog.js";
export const patio = {
  id: "patio",
  title: t("Patio común"),
  artist: t("Comunidad Umbral"),
  category: "Encuentro",
  description: t(
    "Un atrio para encontrarse entre exposiciones, alrededor de una escultura suspendida.",
  ),
  cover: art("patio.webp"),
  works: [],
  music: recordings.six.url,
  recording: recordings.six,
  wall_color: "#bfae96",
  finish: "Piedra",
};
export async function showPatio(walk, login, user, isCurrent) {
  $("#main").innerHTML =
    `<a data-nav href="./" class="crumb">${icon("back", 16)} ${t("Explorar salas")}</a><section class="patio-layout"><div class="patio-cover"><img src="${esc(patio.cover)}" alt="${t("Atrio de piedra verde con una escultura de latón suspendida sobre un espejo de agua")}"><div><p class="kicker"><i></i> ${t("PUNTO DE ENCUENTRO")}</p><h1>${t("Patio común")}<span>.</span></h1><button class="secondary" id="patio-walk">${icon("walk")} ${t("Recorrer el patio en 3D")}</button></div></div><section id="patio-chat" class="conversation"><h2>${t("Sumate a la charla")}</h2><p>${t("Entrá a un grupo de hasta seis personas. Podés leer como visitante o ingresar a tu cuenta para escribir y usar la voz.")}</p><button class="primary" id="join-patio">${icon("users")} ${t("Entrar al grupo")}</button><p role="status" class="form-status"></p></section><section class="patio-music"><h2>${t("Escuchar en el patio")}</h2>${credit(patio.recording)}<audio controls loop preload="none" src="${esc(patio.music)}" aria-label="Cylinder Six · Chris Zabriskie"></audio></section></section>`;
  $("#patio-walk").onclick = walk;
  let meeting = null,
    closed = false;
  const join = $("#join-patio"),
    host = $("#patio-chat");
  join.onclick = async () => {
    join.disabled = true;
    try {
      const { joinMeeting } = await import("./meeting.js");
      const m = await joinMeeting(
        "patio",
        () => ({ x: 0, z: 6.6, a: 0 }),
        () => {},
        () => {
          if (isCurrent())
            host.textContent = t("La visita venció. Volvé a entrar al patio.");
        },
      );
      if (closed || !isCurrent()) {
        m.dispose();
        return;
      }
      meeting = m;
      m.mount(host, login);
    } catch (e) {
      host.querySelector("[role=status]").textContent = failure(e);
      join.disabled = false;
    }
  };
  return () => {
    closed = true;
    meeting?.dispose();
  };
}
