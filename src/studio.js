import { t, language } from "./i18n.js";
import {
  studioRoom,
  prepare,
  saveRoom,
  uploadWork,
  deleteWork,
  saveWork,
} from "./backend.js";
import { usesCloudFile } from "./cloud-media.js";
import { mediaLink } from "./media-link.js";
import { mountEditor } from "./mount-editor.js";
import { positionName } from "./installation.js";
import { categories } from "./catalog.js";
import { client } from "./backend.js";
import { fileAccept, safeLink, typeLabels } from "./formats.js";
import { icon } from "./icons.js";
import { $, esc, dialog, panel, failure, toast } from "./ui.js";

const options = (values, active) =>
  values
    .map(
      (v) =>
        `<option value="${esc(v)}" ${v === active ? "selected" : ""}>${esc(t(v))}</option>`,
    )
    .join("");
export async function openStudio(user, refresh, navigate, demo = false) {
  if (!user && !demo) throw Error(t("Ingresá para editar tu sala."));
  const example = demo ? await import("./demo-studio.js") : null;
  const read = () => (demo ? example.exampleRoom() : studioRoom(user.id));
  let room = await read(),
    selectedWork = null;
  if (!room) {
    panel(
      t("Mi espacio"),
      `<p>${t("Podés seguir como visitante. Si querés exponer, creá una de las 100 salas del piloto. Podés agregar cuatro obras, con archivos o enlaces.")}</p><div class="row space-actions"><button id="create-room" class="primary">${t("Crear mi sala")}</button><button class="secondary" data-close>${t("Seguir explorando")}</button></div><p class="form-status" role="status"></p>`,
    );
    $("#create-room").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const r = await client.rpc("create_my_gallery", {
          ui_language: language,
        });
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
    t(demo ? "Editar la sala de ejemplo" : "Mi sala"),
    `<p class="studio-intro">${demo ? t("Probá con estas obras o con un archivo tuyo. Los cambios duran hasta que recargues la página y solo los ves vos.") : t("Primero prepará la sala. Después subí tus obras, ubicá cada una en el plano y publicá cuando estés listo.")}</p><form id="room-form"><div class="two"><label>${t("Nombre de la sala")}<input name="title" required maxlength="72" value="${esc(room.title)}"></label><label>${t("Nombre de artista")}<input name="artist" required maxlength="48" value="${esc(room.artist)}"></label></div>
    <label>${t("Descripción")}<textarea name="description" rows="2" maxlength="420">${esc(room.description)}</textarea></label>
    <div class="two"><label>${t("Disciplina")}<select name="category">${options(categories, room.category)}</select></label><label>${t("Color de las paredes")}<input type="color" name="wall_color" value="${esc(room.wall_color)}"></label></div>
    <div class="two"><label>${t("Tamaño de la sala")}<select name="room_size">${[
      ["intimate", "Íntima · 13,4 × 15,1 m"],
      ["standard", "Galería · 16 × 18 m"],
      ["spacious", "Amplia · 19,2 × 21,6 m"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === room.room_size ? "selected" : ""}>${t(l)}</option>`,
      )
      .join("")}</select></label>
    <label>${t("Cartelas junto a las obras")}<select name="label_style">${[
      ["wall", "Letras sobre la pared"],
      ["paper", "Papel marfil"],
      ["hidden", "Sin cartelas"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === room.label_style ? "selected" : ""}>${t(l)}</option>`,
      )
      .join("")}</select></label></div>
    <div class="two"><label>${t("Material del piso")}<select name="finish">${options(["Piedra", "Madera", "Basalto"], room.finish)}</select></label><label>${t("Música ambiente")}<select name="music_slot"></select></label></div><small>${t("Para elegir una canción, primero subila en Obras y archivos. El visitante decide cuándo escucharla.")}</small>
    <fieldset class="studio-links"><legend>${t("Web, redes y proyectos")}</legend><label>${t("Biografía del artista")}<textarea name="artist_bio" maxlength="700" rows="3">${esc(room.artist_bio)}</textarea></label>${[
      ["website", t("Sitio web")],
      ["social_url", t("Red social")],
      ["project_url", t("Repositorio o demo")],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<input type="url" name="${key}" maxlength="420" placeholder="https://…" value="${esc(room[key])}"></label>`,
      )
      .join(
        "",
      )}<details class="extra-social" ${room.social_url_2 || room.social_url_3 ? "open" : ""}><summary>${t("Otras redes sociales")}</summary>${[2, 3].map((n) => `<label>${t("Red social")} ${n}<input type="url" name="social_url_${n}" maxlength="420" placeholder="https://…" value="${esc(room["social_url_" + n])}"></label>`).join("")}</details></fieldset>
    <label class="checkline" ${demo ? "hidden" : ""}><input type="checkbox" name="published" ${room.published ? "checked" : ""}> ${t("Mostrar mi sala en el catálogo público")}</label>
    <div class="row"><button class="primary" type="submit">${t("Guardar sala")}</button><button class="secondary" type="button" id="preview-room">${t("Guardar y recorrer en 3D")} ${icon("external", 15)}</button></div><p class="form-status" role="status"></p>${demo ? "" : `<button type="button" id="release-room" class="text-btn" hidden>${t("Eliminar mi sala vacía y liberar el cupo")}</button>`}</form>
    <section class="studio-section"><h3>${t("Obras")} <span id="quota"></span></h3><p class="usage" id="storage-usage"></p><details class="budget-help"><summary>${t("Cómo se calcula el espacio")}</summary><p>${t(demo || room.cloud ? "Cada sala tiene 48 MiB propios entre obras y miniaturas. Cada archivo admite hasta 32 MiB. Los PDF usan el espacio para documentos que ves al elegir el archivo." : "Cada artista tiene 6 MiB reservados. Podés llegar a 48 MiB por sala usando la bolsa compartida de 200 MiB. El máximo por archivo listo es 32 MiB. Los enlaces no gastan espacio de archivos.")}</p></details><p>${t("Elegí una obra para editar su título, su cartela y su lugar en la sala.")}</p><div class="row add-art"><button type="button" class="secondary" data-jump="upload-form">${icon("upload", 16)} ${t("Subir un archivo")}</button><button type="button" class="secondary" data-jump="link-form">${icon("external", 16)} ${t("Usar un enlace")}</button></div><div id="work-list"></div><div id="mount-editor"></div>
    <form id="upload-form"><h3>${t("Subir un archivo")}</h3><p>${t("Cada archivo o enlace ocupa uno de los cuatro lugares. Las miniaturas se incluyen en el espacio usado.")}</p>
    <small>${demo ? t("Los archivos del ejemplo se quedan en esta pestaña.") : t("Los archivos que subís se pueden abrir por enlace directo, incluso en borrador. Subí material propio o con permiso.")}</small><label>${t("Archivo de la obra")}<input name="file" type="file" required accept="${fileAccept}"></label><label>${t("Título de la obra")}<input name="title" required maxlength="80"></label>
    <label class="checkline" id="compress-option" hidden><input type="checkbox" name="optimize" checked> ${t("Optimizar audio o video en mi dispositivo")}</label><p id="file-estimate" role="status"></p><details><summary>${t("Formatos y visualizadores")}</summary><p>${t("Imágenes JPG, PNG, WebP, AVIF, BMP y primer cuadro de GIF. Video MP4, WebM, MOV y OGV. Audio MP3, Ogg/Opus, WAV, FLAC y M4A. La reproducción depende del códec del navegador.")}</p><p>${t("Modelos GLB, glTF autocontenido, STL, OBJ y PLY ASCII. Se conserva geometría estática y color base compatible, hasta 60.000 triángulos. Los modelos se pueden girar y acercar.")}</p><p>${t("PDF página por página, CSV y TSV como tablas. Código, HTML, SVG, Markdown, JSON, cuadernos Jupyter y otros archivos de texto se leen como texto UTF-8 de hasta 512 KiB. Para una demo interactiva agregá su enlace en Sala.")}</p></details>
    <button class="secondary" type="submit">${icon("upload")} ${t("Subir obra")}</button><p role="status" class="form-status"></p></form>
    <form id="link-form"><h3>${t("Agregar una obra por enlace")}</h3><p>${t("Para piezas largas, pegá un video de YouTube o Vimeo, o una pista de SoundCloud. Ocupa un lugar y cero bytes de tu cupo.")}</p><label>${t("Enlace a la obra")}<input type="url" required name="url" placeholder="https://…" maxlength="420"></label><label>${t("Título de la obra")}<input required name="title" maxlength="80"></label><button class="secondary" type="submit">${t("Agregar enlace")}</button><p role="status" class="form-status"></p></form></section>`,
    "studio",
  );
  const form = $("#room-form"),
    up = $("#upload-form"),
    music = form.elements.music_slot;
  form.insertAdjacentHTML(
    "beforebegin",
    `<div class="studio-tabs"><button class="chip active" type="button" aria-pressed="true" data-studio-tab="room">${t("Sala y enlaces")}</button><button class="chip" type="button" aria-pressed="false" data-studio-tab="works">${t("Obras y archivos")}</button></div>`,
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
  const links = $("#link-form"),
    used = (n) =>
      n < 1024
        ? n + " B"
        : n < 1024 ** 2
          ? (n / 1024).toLocaleString(language, { maximumFractionDigits: 1 }) +
            " KiB"
          : (n / 1024 ** 2).toLocaleString(language, {
              maximumFractionDigits: 2,
            }) + " MiB";
  let prepared = null,
    preparation = null,
    uploading = false;
  const uploadButton = up.querySelector("[type=submit]"),
    estimate = $("#file-estimate");
  const syncButtons = () => {
    uploadButton.disabled = uploading || !prepared || room.works.length >= 4;
    links.querySelector("[type=submit]").disabled = room.works.length >= 4;
  };
  for (const b of section.querySelectorAll("[data-jump]"))
    b.onclick = () => {
      const input = $("#" + b.dataset.jump + " input");
      input.scrollIntoView({ block: "center" });
      input.focus();
    };
  async function preflight() {
    preparation?.abort();
    const controller = new AbortController();
    preparation = controller;
    prepared = null;
    syncButtons();
    const file = up.elements.file.files[0];
    $("#compress-option").hidden =
      !file ||
      !/[.](mp3|wav|opus|ogg|flac|m4a|webm|mp4|mov|ogv)$/i.test(file.name);
    if (!file) {
      estimate.textContent = "";
      return;
    }
    if (!up.elements.title.value)
      up.elements.title.value = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
    const base = t("Original") + " " + used(file.size);
    estimate.textContent = base + " · " + t("Preparando archivo…");
    try {
      const item = await prepare(file, {
        available: room.available,
        optimize: up.elements.optimize.checked,
        signal: controller.signal,
        progress: (n) => {
          if (!controller.signal.aborted)
            estimate.textContent =
              base + " · " + t("Optimizando") + " " + n + "%";
        },
      });
      if (controller.signal.aborted) return;
      const size = item.blob.size + (item.preview?.size || 0);
      const available =
        !demo && room.cloud && !usesCloudFile(item)
          ? room.legacyAvailable
          : room.available;
      if (size > available && available < room.available)
        throw Error("DOCUMENT_BYTES_FULL");
      if (item.blob.size > 32 * 1024 ** 2 || size > available)
        throw Error("PILOT_BYTES_FULL");
      prepared = item;
      estimate.textContent =
        base +
        " · " +
        t("Se subirán") +
        " " +
        used(size) +
        (size >= 1024 ? " (" + size.toLocaleString(language) + " B)" : "") +
        " · " +
        t("Quedarán") +
        " " +
        used(available - size) +
        (!demo && room.cloud && !usesCloudFile(item)
          ? " · " + t("Espacio para documentos")
          : "");
    } catch (e) {
      if (!controller.signal.aborted) estimate.textContent = failure(e);
    } finally {
      syncButtons();
    }
  }
  up.elements.file.onchange = preflight;
  up.elements.optimize.onchange = preflight;
  dialog.addEventListener("close", () => preparation?.abort(), { once: true });
  links.onsubmit = async (e) => {
    e.preventDefault();
    const b = links.querySelector("button"),
      status = $(".form-status", links);
    b.disabled = true;
    try {
      const data = new FormData(links),
        link = mediaLink(data.get("url")),
        title = data.get("title").trim();
      if (!link)
        throw Error(
          t(
            "Pegá el enlace público a un video de YouTube o Vimeo, o a una pista de SoundCloud.",
          ),
        );
      if (demo) example.linkExample(title, link);
      else {
        const { error } = await client.rpc("add_gallery_link", {
          work_title: title,
          provider: link.extension,
          work_url: link.url,
        });
        if (error) throw error;
      }
      links.reset();
      status.textContent = t("Obra agregada.");
      await reloadWorks();
    } catch (e) {
      status.textContent = failure(e);
    } finally {
      syncButtons();
    }
  };
  function list(selected) {
    if (!demo) $("#release-room").hidden = room.works.length !== 0;
    $("#quota").textContent = room.works.length + " / 4";
    $("#storage-usage").textContent =
      t("Usados") +
      " " +
      used(room.bytes || 0) +
      " · " +
      t("Disponibles ahora") +
      " " +
      used(room.available || 0);
    $("#work-list").innerHTML = room.works
      .map(
        (w) =>
          `<div class="work-row"><button class="work-select" type="button" data-edit="${esc(w.id)}" aria-pressed="${w.id === selectedWork}" ${w.ready ? "" : "disabled"}>${icon(w.type === "model" ? "box" : w.type === "audio" ? "audio" : w.type === "video" ? "video" : "palette", 18)}<span><strong>${esc(w.title)}</strong><small>${w.ready ? positionName(w.slot) : t("Subida incompleta")}</small></span></button><button type="button" data-remove="${esc(w.id)}" aria-label="${t("Retirar")} ${esc(w.title)}">${icon("trash", 17)}</button></div>`,
      )
      .join("");
    mountEditor(
      $("#mount-editor"),
      room,
      room.works.find((w) => w.id === selectedWork),
      async (id, slot, values) => {
        const trackId = room.works.find(
          (w) => w.slot === Number(music.value),
        )?.id;
        if (demo) {
          example.moveExample(id, slot);
          example.editExample(id, values);
        } else await saveWork(id, slot, values);
        await reloadWorks(trackId);
        toast(t("Montaje guardado."));
      },
    );
    music.innerHTML =
      `<option value="">${t("Sin música")}</option>` +
      room.works
        .filter((w) => w.type === "audio" && w.ready && !w.external_url)
        .map((w) => `<option value="${w.slot}">${esc(w.title)}</option>`)
        .join("");
    music.value = String(selected ?? "");
    if (music.selectedIndex < 0) music.value = "";
    syncButtons();
  }
  list(room.music_slot);
  if (!demo)
    $("#release-room").onclick = async (e) => {
      if (
        !confirm(
          t(
            "¿Eliminar la sala vacía y liberar su cupo? Conservás tu cuenta y tus favoritos de otras salas.",
          ),
        )
      )
        return;
      const button = e.currentTarget;
      button.disabled = true;
      try {
        const { error } = await client.rpc("release_my_gallery");
        if (error) throw error;
        await openStudio(user, refresh, navigate);
      } catch (err) {
        $(".form-status", form).textContent = failure(err);
        button.disabled = false;
      }
    };
  async function persistRoom() {
    const btn = form.querySelector("[type=submit]"),
      status = $(".form-status", form);
    btn.disabled = true;
    status.textContent = t("Guardando…");
    try {
      const data = Object.fromEntries(new FormData(form));
      for (const key of [
        "website",
        "social_url",
        "social_url_2",
        "social_url_3",
        "project_url",
      ]) {
        data[key] = data[key].trim();
        if (data[key] && !safeLink(data[key]))
          throw Error(
            t("Ingresá enlaces HTTPS completos, sin usuario ni contraseña."),
          );
      }
      data.published = form.elements.published.checked;
      data.music_slot = Number(data.music_slot) || null;
      if (demo) example.saveExample(data);
      else await saveRoom(user.id, data);
      status.textContent = t("Cambios guardados.");
      room = { ...room, ...data };
      return true;
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      btn.disabled = false;
    }
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    void persistRoom();
  };
  let navigating = false;
  $("#preview-room").onclick = async () => {
    if (!form.reportValidity() || !(await persistRoom())) return;
    navigating = true;
    dialog.close();
    navigate("?sala=" + room.id + "&modo=3d");
  };
  async function reloadWorks(trackId) {
    const latest = await read();
    if (latest && up.isConnected) {
      room = latest;
      if (!room.works.some((w) => w.id === selectedWork)) selectedWork = null;
      list(
        trackId ? room.works.find((w) => w.id === trackId)?.slot : music.value,
      );
    }
  }
  up.onsubmit = async (e) => {
    e.preventDefault();
    if (!prepared || uploading) return;
    uploading = true;
    const btn = uploadButton,
      status = $(".form-status", up);
    btn.disabled = true;
    status.textContent = t("Preparando y subiendo el archivo…");
    try {
      const data = new FormData(up);
      await (demo ? example.uploadExample : uploadWork)(
        room,
        data.get("file"),
        data.get("title").trim(),
        prepared,
      );
      up.reset();
      prepared = null;
      estimate.textContent = "";
      $("#compress-option").hidden = true;
      status.textContent = t("Obra subida.");
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      uploading = false;
      syncButtons();
      try {
        await reloadWorks();
      } catch {
        status.textContent += ` ${t("Reabrí el editor para actualizar la lista.")}`;
      }
    }
  };
  $("#work-list").onclick = async (e) => {
    const select = e.target.closest("[data-edit]");
    if (select) {
      selectedWork = select.dataset.edit;
      list(music.value);
      return;
    }
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const w = room.works.find((w) => w.id === b.dataset.remove);
    if (
      !w ||
      !confirm(t("¿Retirar «") + w.title + t("» y eliminar su archivo?"))
    )
      return;
    b.disabled = true;
    try {
      await (demo ? example.deleteExample : deleteWork)(w);
      await reloadWorks();
      toast(t("Obra retirada."));
    } catch (err) {
      $(".form-status", up).textContent = failure(err);
      b.disabled = false;
    }
  };
  dialog.addEventListener(
    "close",
    () => {
      if (!navigating) refresh();
    },
    { once: true },
  );
}
