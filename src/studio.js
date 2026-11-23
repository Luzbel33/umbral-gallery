import { readRoom, saveRoom, uploadWork, deleteWork } from "./backend.js";
import { categories } from "./catalog.js";
import { icon } from "./icons.js";
import { $, esc, dialog, panel, failure, toast } from "./ui.js";

const options = (values, active) =>
  values
    .map((v) => `<option ${v === active ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
export async function openStudio(user, refresh, navigate) {
  if (!user) throw Error("Ingresá para editar tu sala.");
  let room = await readRoom(user.id);
  if (!room)
    throw Error(
      "Todavía no pudimos abrir tu sala. Reintentá en unos segundos.",
    );
  panel(
    "Mi sala",
    `<form id="room-form"><div class="two"><label>Nombre de la sala<input name="title" required maxlength="72" value="${esc(room.title)}"></label><label>Nombre de artista<input name="artist" required maxlength="48" value="${esc(room.artist)}"></label></div>
    <label>Descripción<textarea name="description" rows="2" maxlength="420">${esc(room.description)}</textarea></label>
    <div class="two"><label>Disciplina<select name="category">${options(categories, room.category)}</select></label><label>Color de las paredes<input type="color" name="wall_color" value="${esc(room.wall_color)}"></label></div>
    <div class="two"><label>Material del piso<select name="finish">${options(["Piedra", "Madera", "Basalto"], room.finish)}</select></label><label>Música ambiente<select name="music_slot"></select></label></div>
    <label class="checkline"><input type="checkbox" name="published" ${room.published ? "checked" : ""}> Mostrar mi sala en el catálogo público</label>
    <div class="row"><button class="primary" type="submit">Guardar sala</button><button class="secondary" type="button" id="preview-room">Ver mi sala ${icon("external", 15)}</button></div><p class="form-status" role="status"></p></form>
    <section class="studio-section"><h3>Obras <span id="quota"></span></h3><div id="work-list"></div>
    <form id="upload-form"><p>Hasta 8 obras de 12 MB cada una. El archivo se puede abrir con su enlace directo desde que lo subís. Subí material propio o con permiso.</p>
    <label>Título de la obra<input name="title" required maxlength="80"></label><label>Imagen, video o canción<input name="file" type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,audio/x-wav,audio/mp4,.m4a"></label>
    <button class="secondary" type="submit">${icon("upload")} Subir obra</button><p role="status" class="form-status"></p></form></section>`,
    "studio",
  );
  const form = $("#room-form"),
    up = $("#upload-form"),
    music = form.elements.music_slot;
  function list(selected) {
    $("#quota").textContent = "(" + room.works.length + "/8)";
    $("#work-list").innerHTML = room.works
      .map(
        (w) =>
          `<div class="work-row">${icon(w.type === "audio" ? "audio" : w.type === "video" ? "video" : "palette", 17)}<span>${esc(w.title)}${w.ready ? "" : " · Subida incompleta"}</span><button type="button" data-remove="${esc(w.id)}" aria-label="Retirar ${esc(w.title)}">${icon("trash", 17)}</button></div>`,
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
  dialog.addEventListener(
    "close",
    () => {
      if (!new URL(location.href).searchParams.has("sala")) refresh();
    },
    { once: true },
  );
}
