import { exhibits } from "./catalog.js";
import { rooms } from "./backend.js";
import { patio } from "./patio.js";
import { $, panel, esc, dialog } from "./ui.js";
import { icon } from "./icons.js";
export function directory(current) {
  panel(
    "Cambiar de sala",
    '<div id="destinations"></div><p id="dest-status" role="status"></p><button class="secondary" id="dest-more" hidden>Ver más salas</button>',
  );
  const list = $("#destinations"),
    more = $("#dest-more"),
    status = $("#dest-status");
  let offset = 0;
  const append = (r) => {
    if (r.id !== current)
      list.insertAdjacentHTML(
        "beforeend",
        `<a data-nav class="destination" href="?sala=${encodeURIComponent(r.id)}&amp;modo=3d"><span>${esc(r.title)}<small>${esc(r.artist)}</small></span>${icon("arrow", 16)}</a>`,
      );
  };
  [patio, ...exhibits].forEach(append);
  async function load() {
    more.hidden = true;
    status.textContent = "Buscando salas de artistas…";
    try {
      const rows = await rooms({ offset, limit: 13 });
      if (!list.isConnected || !dialog.open) return;
      rows.slice(0, 12).forEach(append);
      offset += 12;
      more.hidden = rows.length <= 12;
      status.textContent = "";
    } catch {
      status.textContent = "No se pudieron cargar las salas de artistas.";
      more.textContent = "Reintentar";
      more.hidden = false;
    }
  }
  more.onclick = load;
  void load();
}
