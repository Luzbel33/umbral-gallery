import {
  readRoom,
  saveRoom,
  uploadWork,
  deleteWork,
  placeWork,
} from "./backend.js";
import { categories } from "./catalog.js";
import { client } from "./backend.js";
import { fileAccept, safeLink, typeLabels } from "./formats.js";
import { icon } from "./icons.js";
import { $, esc, dialog, panel, failure, toast } from "./ui.js";

const options = (values, active) =>
  values
    .map((v) => `<option ${v === active ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
const positions = [
  "Fondo izquierdo",
  "Fondo derecho",
  "Lateral izquierdo · fondo",
  "Lateral izquierdo · centro",
  "Lateral izquierdo · entrada",
  "Entrada izquierda",
  "Entrada central",
  "Entrada derecha",
];
function placement(w) {
  return `<select aria-label="Posición de ${esc(w.title)}" data-place="${esc(w.id)}" ${w.ready ? "" : "disabled"}>${positions.map((p, i) => `<option value="${i + 1}" ${i + 1 === w.slot ? "selected" : ""}>${p}</option>`).join("")}</select>`;
}
export async function openStudio(user, refresh, navigate) {
  if (!user) throw Error("Ingresá para editar tu sala.");
  let room = await readRoom(user.id);
  if (!room) {
    panel(
      "Mi espacio",
      '<p>Tu cuenta ya te permite guardar favoritos y participar en el patio. Si querés exponer, podés crear una sala y prepararla antes de publicarla.</p><div class="row space-actions"><button id="create-room" class="primary">Crear mi sala</button><button class="secondary" data-close>Seguir explorando</button></div><p class="form-status" role="status"></p>',
    );
    $("#create-room").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const r = await client.rpc("create_my_gallery");
        if (r.error) throw r.error;
        await openStudio(user, refresh, navigate);
      } catch (err) {
        $("#panel .form-status").textContent = failure(err);
        btn.disabled = false;
      }
    };
    return;
  }
  panel(
    "Mi sala",
    `<form id="room-form"><div class="two"><label>Nombre de la sala<input name="title" required maxlength="72" value="${esc(room.title)}"></label><label>Nombre de artista<input name="artist" required maxlength="48" value="${esc(room.artist)}"></label></div>
    <label>Descripción<textarea name="description" rows="2" maxlength="420">${esc(room.description)}</textarea></label>
    <div class="two"><label>Disciplina<select name="category">${options(categories, room.category)}</select></label><label>Color de las paredes<input type="color" name="wall_color" value="${esc(room.wall_color)}"></label></div>
    <div class="two"><label>Material del piso<select name="finish">${options(["Piedra", "Madera", "Basalto"], room.finish)}</select></label><label>Música ambiente<select name="music_slot"></select></label></div>
    <details class="studio-links"><summary>Web, redes y proyectos</summary>${[
      ["website", "Sitio web"],
      ["social_url", "Red social"],
      ["project_url", "Repositorio o demo"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<input type="url" name="${key}" maxlength="420" placeholder="https://…" value="${esc(room[key])}"></label>`,
      )
      .join("")}</details>
    <label class="checkline"><input type="checkbox" name="published" ${room.published ? "checked" : ""}> Mostrar mi sala en el catálogo público</label>
    <div class="row"><button class="primary" type="submit">Guardar sala</button><button class="secondary" type="button" id="preview-room">Ver mi sala ${icon("external", 15)}</button></div><p class="form-status" role="status"></p></form>
    <section class="studio-section"><h3>Obras <span id="quota"></span></h3><div id="work-list"></div>
    <form id="upload-form"><p>Hasta 8 obras de 12 MB cada una. El archivo se puede abrir con su enlace directo desde que lo subís. Subí material propio o con permiso.</p>
    <label>Archivo de la obra<input name="file" type="file" required accept="${fileAccept}"></label><label>Título de la obra<input name="title" required maxlength="80"></label>
    <details><summary>Formatos y visualizadores</summary><p>Imágenes JPG, PNG, WebP, AVIF, BMP y primer cuadro de GIF. Video MP4, WebM, MOV y OGV. Audio MP3, Ogg/Opus, WAV, FLAC y M4A. La reproducción depende del códec del navegador.</p><p>Modelos GLB, glTF autocontenido, STL, OBJ y PLY ASCII. Se conserva geometría estática y color base compatible, hasta 60.000 triángulos. Los modelos se pueden girar y acercar.</p><p>PDF página por página, CSV y TSV como tablas. Código, HTML, SVG, Markdown, JSON, cuadernos Jupyter y otros archivos de texto se leen como texto UTF-8 de hasta 512 KiB. Para una demo interactiva agregá su enlace en Sala.</p></details>
    <button class="secondary" type="submit">${icon("upload")} Subir obra</button><p role="status" class="form-status"></p></form></section>`,
    "studio",
  );
  const form = $("#room-form"),
    up = $("#upload-form"),
    music = form.elements.music_slot;
  form.insertAdjacentHTML(
    "beforebegin",
    '<div class="studio-tabs"><button class="chip active" type="button" aria-pressed="true" data-studio-tab="room">Sala y enlaces</button><button class="chip" type="button" aria-pressed="false" data-studio-tab="works">Obras y archivos</button></div>',
  );
  const section = $(".studio-section");
  section.hidden = true;
  $(".studio-tabs").onclick = (e) => {
    const b = e.target.closest("[data-studio-tab]");
    if (!b) return;
    const show = b.dataset.studioTab === "works";
    section.hidden = !show;
    form.hidden = show;
    for (const t of $(".studio-tabs").children) {
      t.classList.toggle("active", t === b);
      t.setAttribute("aria-pressed", t === b);
    }
  };
  up.elements.file.onchange = () => {
    const name = up.elements.file.files[0]?.name;
    if (name && !up.elements.title.value)
      up.elements.title.value = name.replace(/\.[^.]+$/, "").slice(0, 80);
  };
  function list(selected) {
    $("#quota").textContent = "(" + room.works.length + "/8)";
    $("#work-list").innerHTML = room.works
      .map(
        (w) =>
          `<div class="work-row">${icon(w.type === "audio" ? "audio" : w.type === "video" ? "video" : "palette", 17)}<span>${esc(w.title)}${w.ready ? "" : " · Subida incompleta"}</span>${placement(w)}<button type="button" data-remove="${esc(w.id)}" aria-label="Retirar ${esc(w.title)}">${icon("trash", 17)}</button></div>`,
      )
      .join("");
    music.innerHTML =
      '<option value="">Sin música</option>' +
      room.works
        .filter((w) => w.type === "audio" && w.ready)
        .map((w) => `<option value="${w.slot}">${esc(w.title)}</option>`)
        .join("");
    music.value = String(selected ?? "");
    if (music.selectedIndex < 0) music.value = "";
    up.querySelector("button").disabled = room.works.length >= 8;
  }
  list(room.music_slot);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]"),
      status = $(".form-status", form);
    btn.disabled = true;
    status.textContent = "Guardando…";
    try {
      const data = Object.fromEntries(new FormData(form));
      for (const key of ["website", "social_url", "project_url"]) {
        data[key] = data[key].trim();
        if (data[key] && !safeLink(data[key]))
          throw Error(
            "Ingresá enlaces HTTPS completos, sin usuario ni contraseña.",
          );
      }
      data.published = form.elements.published.checked;
      data.music_slot = Number(data.music_slot) || null;
      await saveRoom(user.id, data);
      status.textContent = "Cambios guardados.";
      room = { ...room, ...data };
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      btn.disabled = false;
    }
  };
  $("#preview-room").onclick = () => {
    dialog.close();
    navigate("?sala=" + user.id);
  };
  async function reloadWorks() {
    const latest = await readRoom(user.id);
    if (latest && up.isConnected) {
      room = latest;
      list(music.value);
    }
  }
  up.onsubmit = async (e) => {
    e.preventDefault();
    const btn = up.querySelector("button"),
      status = $(".form-status", up);
    btn.disabled = true;
    status.textContent = "Preparando y subiendo el archivo…";
    try {
      const data = new FormData(up);
      await uploadWork(room, data.get("file"), data.get("title").trim());
      up.reset();
      status.textContent = "Obra subida.";
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      btn.disabled = false;
      try {
        await reloadWorks();
      } catch {
        status.textContent += " Reabrí el editor para actualizar la lista.";
      }
    }
  };
  $("#work-list").onclick = async (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const w = room.works.find((w) => w.id === b.dataset.remove);
    if (!w || !confirm("¿Retirar «" + w.title + "» y eliminar su archivo?"))
      return;
    b.disabled = true;
    try {
      await deleteWork(w);
      await reloadWorks();
      toast("Obra retirada.");
    } catch (err) {
      $(".form-status", up).textContent = failure(err);
      b.disabled = false;
    }
  };
  $("#work-list").onchange = async (e) => {
    const select = e.target.closest("[data-place]");
    if (!select) return;
    const track = room.works.find((w) => w.slot === Number(music.value))?.id;
    select.disabled = true;
    try {
      await placeWork(select.dataset.place, Number(select.value));
      await reloadWorks();
      music.value = String(room.works.find((w) => w.id === track)?.slot ?? "");
      toast("Posición guardada.");
    } catch (err) {
      $(".form-status", up).textContent = failure(err);
      list(music.value);
    }
  };
  dialog.addEventListener(
    "close",
    () => {
      if (!new URL(location.href).searchParams.has("sala")) refresh();
    },
    { once: true },
  );
}
