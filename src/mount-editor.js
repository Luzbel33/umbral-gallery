import { t } from "./i18n.js";
import { positionName, positions, workLine } from "./installation.js";
import { icon } from "./icons.js";
import { $, esc, failure } from "./ui.js";

export function mountEditor(el, room, work, save) {
  if (!work?.ready) {
    el.replaceChildren();
    return;
  }
  let slot = work.slot;
  el.innerHTML = `<form class="mount-form"><h3>${t("Montaje de la obra")}</h3><label>${t("Título de la obra")}<input name="title" required maxlength="80" value="${esc(work.title)}"></label>
    <div class="two"><label>${t("Técnica o material")}<input name="medium" maxlength="64" placeholder="${t("Ej. tinta sobre papel")}" value="${esc(work.medium)}"></label><label>${t("Año")}<input type="number" name="year" min="1" max="9999" value="${esc(work.year)}"></label></div>
    <label>${t("Sobre esta obra")}<textarea name="caption" rows="2" maxlength="320" placeholder="${t("¿Qué te gustaría que el visitante descubra?")}">${esc(work.caption)}</textarea></label>
    <div class="label-preview" ${room.label_style === "hidden" ? "hidden" : ""} aria-label="${t("Vista previa de la cartela")}"><i></i><div><strong></strong><small></small></div></div>
    <fieldset class="floor-layout"><legend>${t("Lugar en la sala")}</legend><p>${t("Tocá un punto del plano. Si hay otra obra, intercambian lugares al guardar.")}</p>
    <div class="floor-plan"><i class="plan-glazing"></i><span class="plan-side">${t("Ventanas")}</span><span class="plan-spawn">${icon("walk", 16)} ${t("Entrada al recorrido")}</span>
    ${positions
      .map(([x, z], i) => {
        const other = room.works.find((w) => w.slot === i + 1);
        return `<button type="button" class="plan-pin ${other ? "occupied" : ""}" data-slot="${i + 1}" style="left:${14 + ((x + 8) / 16) * 72}%;top:${16 + ((z + 9) / 18) * 68}%" aria-label="${esc(positionName(i + 1) + (other ? " · " + other.title : ""))}">${i + 1}</button>`;
      })
      .join("")}</div><output class="location-name"></output></fieldset>
    ${work.type === "model" ? `<label>${t("Orientación de la escultura")} <output class="angle"></output><input name="orientation" type="range" min="0" max="359" value="${work.orientation || 0}"><small>${t("Define cómo queda sobre la base. Cada visitante puede girarla y acercarla en el visor.")}</small></label>` : ""}
    <button type="submit" class="primary">${t("Guardar montaje")}</button><p role="status" class="form-status"></p></form>`;
  const form = $("form", el),
    status = $(".form-status", el);
  if (room.label_style === "wall" && /^#[0-9a-f]{6}$/i.test(room.wall_color)) {
    const chip = $(".label-preview", el);
    chip.style.backgroundColor = room.wall_color;
    const rgb = room.wall_color
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255);
    chip.style.color =
      rgb[0] * 0.213 + rgb[1] * 0.715 + rgb[2] * 0.072 > 0.55
        ? "#252824"
        : "#fff8e7";
    chip.querySelector("small").style.color = "inherit";
  }
  function preview() {
    $(".label-preview strong", el).textContent = form.elements.title.value;
    $(".label-preview small", el).textContent = workLine({
      medium: form.elements.medium.value,
      year: form.elements.year.value,
    });
    if (form.elements.orientation)
      $(".angle", el).textContent = form.elements.orientation.value + "°";
  }
  function position() {
    for (const b of el.querySelectorAll("[data-slot]"))
      b.setAttribute("aria-pressed", String(Number(b.dataset.slot) === slot));
    const other = room.works.find((w) => w.slot === slot && w.id !== work.id);
    $(".location-name", el).textContent =
      positionName(slot) +
      (other ? " · " + t("Intercambia con") + " " + other.title : "");
  }
  el.querySelector(".floor-plan").onclick = (e) => {
    const b = e.target.closest("[data-slot]");
    if (b) {
      slot = Number(b.dataset.slot);
      position();
    }
  };
  form.oninput = preview;
  preview();
  position();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await save(work.id, slot, {
        title: form.elements.title.value.trim(),
        medium: form.elements.medium.value.trim(),
        year: Number(form.elements.year.value) || null,
        caption: form.elements.caption.value.trim(),
        orientation: Number(form.elements.orientation?.value) || 0,
      });
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      button.disabled = false;
    }
  };
}
