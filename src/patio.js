import { $, esc, failure } from "./ui.js";
import { icon } from "./icons.js";
import { art } from "./catalog.js";
export const patio = {
  id: "patio",
  title: "Patio común",
  artist: "Comunidad Umbral",
  category: "Encuentro",
  description: "Un espacio para conversar entre exposiciones.",
  cover: art("patio.webp"),
  works: [],
  wall_color: "#bfae96",
  finish: "Piedra",
};
export async function showPatio(walk, login, user, isCurrent) {
  $("#main").innerHTML =
    `<a data-nav href="./" class="crumb">${icon("back", 16)} Explorar salas</a><section class="patio-layout"><div class="patio-cover"><img src="${esc(patio.cover)}" alt="Patio de piedra con olivos, bancos y una pérgola junto al agua"><div><p class="kicker"><i></i> PUNTO DE ENCUENTRO</p><h1>Patio común<span>.</span></h1><button class="secondary" id="patio-walk">${icon("walk")} Recorrer el patio en 3D</button></div></div><section id="patio-chat" class="conversation"><h2>Sumate a la charla</h2><p>Entrá a un grupo de hasta seis personas. Podés leer como visitante o ingresar a tu cuenta para escribir y usar la voz.</p><button class="primary" id="join-patio">${icon("users")} Entrar al grupo</button><p role="status" class="form-status"></p></section></section>`;
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
            host.textContent = "La visita venció. Volvé a entrar al patio.";
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
