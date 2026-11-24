import * as T from "three";
import { t } from "./i18n.js";
import { $, esc, failure, toast } from "./ui.js";
import { icon } from "./icons.js";
import { positions, positionName } from "./installation.js";
import "./visual-studio.css";

const walls = [
  { title: "Fondo", slots: [1, 2] },
  { title: "Lateral", slots: [3, 4, 5] },
  { title: "Entrada", slots: [6, 7, 8] },
];
const sectionFor = (slot) =>
  walls.findIndex((wall) => wall.slots.includes(slot));
const finishes = ["Piedra", "Madera", "Basalto"];

export function editInstallation({
  root,
  view,
  room,
  world,
  invalidate,
  close,
  openFiles,
}) {
  const camera = new T.PerspectiveCamera(54, 1, 0.05, 40);
  const works = room.works.filter((w) => w.ready !== false);
  let selected = works[0],
    section = selected ? sectionFor(selected.slot) : 0;
  let ambience = !selected,
    busy = false,
    live = true,
    closeView;
  const controls = document.createElement("aside");
  controls.className = "visual-tools";
  controls.setAttribute("aria-label", t("Editar en 3D"));
  controls.innerHTML = `<header><div><h1>${t("Editar en 3D")}</h1><p>${esc(room.title)}</p></div><button type="button" class="visual-close" aria-label="${t("Volver al recorrido")}">${icon("walk",16)} ${t("Recorrer")}</button></header>
    <div class="visual-tabs"><button data-mode="works">${icon("layers", 16)} ${t("Obras")}</button><button data-mode="room">${icon("palette", 16)} ${t("Ambiente")}</button></div>
    <section data-works>${
      works.length
        ? `<label>${t("Obra seleccionada")}<select data-work>${works.map((w) => `<option value="${esc(w.id)}">${esc(w.title)}</option>`).join("")}</select></label>
      <p class="tool-hint">${t("Tocá un punto para mover la obra. Si está ocupado, las dos obras intercambian lugar.")}</p>
      <label data-angle-field>${t("Orientación de la escultura")} <output></output><input data-angle type="range" min="0" max="359" step="1"></label>`
        : `<p>${t("Subí tu primera obra desde Obras y archivos. Aparecerá acá automáticamente.")}</p>`
    }</section>
    <section data-room><label class="wall-paint">${t("Color de las paredes")}<input type="color" data-paint></label>
      <fieldset><legend>${t("Material del piso")}</legend><div class="finish-options">${finishes.map((f) => `<button data-finish="${f}"><i aria-hidden="true"></i>${t(f)}</button>`).join("")}</div></fieldset></section>
    <p class="visual-status" role="status"></p>
    <button class="visual-files">${icon("upload", 17)} ${t("Obras y archivos")} ${icon("external",14)}</button>`;
  const overlay = document.createElement("div");
  overlay.className = "visual-overlay";
  overlay.innerHTML = `<div class="wall-switch" role="group" aria-label="${t("Pared a la vista")}">${walls.map(({ title }, i) => `<button data-wall="${i}">${t(title)}</button>`).join("")}</div><div class="mount-points"></div>`;
  const zoom = document.createElement("button");
  zoom.className = "mount-zoom";
  zoom.innerHTML = icon("scan", 18);
  overlay.append(zoom);
  view.append(overlay);
  root.append(controls);
  root.classList.add("arranging");
  const points = $(".mount-points", overlay),
    status = $(".visual-status", controls);
  const angle = $("[data-angle]", controls),
    paint = $("[data-paint]", controls);
  const vector = new T.Vector3();

  function fit() {
    const slots = walls[section].slots;
    const [x1, z1, yaw] = positions[slots[0] - 1],
      [x2, z2] = positions[slots.at(-1) - 1];
    const s = world.scale;
    const compact = view.clientWidth < 600;
    const focused = closeView ?? compact;
    const spot = slots.includes(selected?.slot)
      ? selected.slot
      : slots[Math.floor(slots.length / 2)];
    const [focusX, focusZ] = positions[spot - 1];
    const cx = (focused ? focusX : (x1 + x2) / 2) * s;
    const cz = (focused ? focusZ : (z1 + z2) / 2) * s;
    const aspect = view.clientWidth / Math.max(1, view.clientHeight);
    const width = focused ? 5.1 : Math.hypot(x2 - x1, z2 - z1) * s + 4.8;
    const distance = focused ? 5.8 : 9 * s;
    camera.aspect = aspect;
    camera.fov = T.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.max(width / aspect, focused ? 3.6 : 5.2) / (2 * distance),
        ),
    );
    camera.position.set(
      cx + Math.sin(yaw) * distance,
      2.25,
      cz + Math.cos(yaw) * distance,
    );
    camera.lookAt(cx, 1.9, cz);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    overlay.classList.toggle("dock-points", focused || compact);
    const zoomLabel = t(focused ? "Ver toda la pared" : "Ver de cerca");
    zoom.setAttribute("aria-label", zoomLabel);
    zoom.setAttribute("aria-pressed", String(focused));
    zoom.title = zoomLabel;
    for (const pin of points.children) {
      const [x, z, a] = positions[Number(pin.dataset.place) - 1];
      vector
        .set(x * s + Math.sin(a) * 1.05, 0.3, z * s + Math.cos(a) * 1.05)
        .project(camera);
      pin.style.order = Math.round((vector.x + 1) * 100);
      pin.style.left = (vector.x + 1) * 50 + "%";
      pin.style.top = (1 - vector.y) * 50 + "%";
    }
    invalidate();
  }
  function refresh() {
    for (const b of controls.querySelectorAll("[data-mode]"))
      b.setAttribute(
        "aria-pressed",
        String((b.dataset.mode === "room") === ambience),
      );
    $("[data-works]", controls).hidden = ambience;
    $("[data-room]", controls).hidden = !ambience;
    paint.value = room.wall_color;
    for (const b of controls.querySelectorAll("[data-finish]"))
      b.setAttribute("aria-pressed", String(b.dataset.finish === room.finish));
    if (selected) {
      $("[data-work]", controls).value = selected.id;
      $("[data-angle-field]", controls).hidden = selected.type !== "model";
      angle.value = selected.orientation || 0;
      $("output", controls).textContent = angle.value + "°";
    }
    for (const b of overlay.querySelectorAll("[data-wall]"))
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.wall) === section),
      );
    points.replaceChildren();
    if (!ambience && selected) {
      for (const slot of walls[section].slots) {
        const other = room.works.find((w) => w.slot === slot);
        const here = other?.id === selected.id;
        const label = here
          ? t("Ubicación actual")
          : other
            ? t("Intercambiar")
            : t("Mover aquí");
        const pin = document.createElement("button");
        pin.dataset.place = slot;
        pin.disabled = busy || here || other?.ready === false;
        pin.setAttribute(
          "aria-label",
          label +
            " · " +
            positionName(slot) +
            (other ? " · " + other.title : ""),
        );
        pin.classList.toggle("current-mount", here);
        pin.innerHTML =
          icon(here ? "check" : other ? "reset" : "plus", 16) +
          `<span>${esc(label)}</span><small>${slot}</small>`;
        points.append(pin);
      }
    }
    fit();
  }
  function select(work) {
    if (!work || busy || ambience) return;
    selected = work;
    section = sectionFor(work.slot);
    status.textContent = "";
    refresh();
  }
  async function save(write, commit, restore) {
    if (busy) return;
    busy = true;
    const active = document.activeElement;
    const keyboard = active?.matches(":focus-visible");
    const inputs = controls.querySelectorAll("button, select, input");
    for (const input of inputs) input.disabled = true;
    status.textContent = t("Guardando…");
    overlay.inert = true;
    try {
      await write();
      if (!live) return;
      commit();
      status.textContent = t("Cambios guardados.");
    } catch (error) {
      if (!live) return;
      restore?.();
      status.textContent = failure(error);
    } finally {
      busy = false;
      if (live) {
        for (const input of inputs) input.disabled = false;
        overlay.inert = false;
        refresh();
        if (keyboard) {
          const next = active.isConnected ? active : $("[data-work]", controls);
          next?.focus({ preventScroll: true });
        }
      }
    }
  }
  function move(slot) {
    const work = selected,
      from = work.slot;
    const other = room.works.find((w) => w.slot === slot);
    if (from === slot || other?.ready === false) return;
    world.moveMount(work.id, slot);
    if (other) world.moveMount(other.id, from);
    void save(
      async () => {
        if (room.demo)
          (await import("./demo-studio.js")).moveExample(work.id, slot);
        else await (await import("./backend.js")).moveWork(work.id, slot);
      },
      () => {
        work.slot = slot;
        if (other) other.slot = from;
        if (room.music_slot === from) room.music_slot = slot;
        else if (room.music_slot === slot) room.music_slot = from;
      },
      () => {
        world.moveMount(work.id, from);
        if (other) world.moveMount(other.id, slot);
      },
    );
  }
  function appearance(key, value) {
    const apply = key === "finish" ? world.setFinish : world.setWallColor;
    apply(value);
    if (value === room[key]) return;
    void save(
      async () => {
        const values = { [key]: value };
        if (room.demo) (await import("./demo-studio.js")).saveExample(values);
        else await (await import("./backend.js")).saveRoom(room.id, values);
      },
      () => {
        room[key] = value;
      },
      () => apply(room[key]),
    );
  }
  overlay.onclick = (event) => {
    if (busy) return;
    if (event.target.closest(".mount-zoom")) {
      closeView = !(closeView ?? view.clientWidth < 600);
      fit();
      return;
    }
    const wall = event.target.closest("[data-wall]"),
      pin = event.target.closest("[data-place]");
    if (wall) {
      section = Number(wall.dataset.wall);
      refresh();
    } else if (pin && !pin.disabled) move(Number(pin.dataset.place));
  };
  controls.onclick = (event) => {
    if (busy) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches(".visual-close")) close();
    else if (button.matches(".visual-files")) void openFiles().catch((e) => {
      if (live) status.textContent = failure(e);
      else toast(failure(e));
    });
    else if (button.dataset.mode) {
      ambience = button.dataset.mode === "room";
      status.textContent = "";
      refresh();
    } else if (button.dataset.finish)
      appearance("finish", button.dataset.finish);
  };
  if (angle) {
    $("[data-work]", controls).onchange = (event) =>
      select(works.find((w) => w.id === event.target.value));
    angle.oninput = () => {
      $("output", controls).textContent = angle.value + "°";
      world.turnMount(selected.id, Number(angle.value));
    };
    angle.onchange = () => {
      const work = selected,
        value = Number(angle.value);
      void save(
        async () => {
          if (room.demo)
            (await import("./demo-studio.js")).editExample(work.id, {
              orientation: value,
            });
          else
            await (
              await import("./backend.js")
            ).turnWork(room.id, work.id, value);
        },
        () => {
          work.orientation = value;
        },
        () => world.turnMount(work.id, work.orientation || 0),
      );
    };
  }
  paint.oninput = () => world.setWallColor(paint.value);
  paint.onchange = () => appearance("wall_color", paint.value);
  refresh();
  $(".visual-close", controls).focus();
  return {
    camera,
    fit,
    select,
    get busy() {
      return busy;
    },
    dispose() {
      live = false;
      controls.remove();
      overlay.remove();
      root.classList.remove("arranging");
      // A native picker or range can lose focus before dispatching change.
      world.setWallColor(room.wall_color);
      if (selected?.type === "model")
        world.turnMount(selected.id, selected.orientation || 0);
    },
  };
}
