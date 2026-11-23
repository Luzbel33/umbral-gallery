import { t } from "./i18n.js";
import { bindJoystick } from "./joystick.js";
import * as T from "three";
import { lightDust } from "./atmosphere.js";
import { exhibition } from "./inaugural.js";
import { profile, credit } from "./profile.js";
import { furnish } from "./architecture.js";
import { courtyard } from "./courtyard.js";
import { icon } from "./icons.js";
import { $, esc, dialog, panel, toast, failure } from "./ui.js";
import "./walk.css";
export function enterWalk(room, { exit, openPiece, login }) {
  const main = $("#main");
  const economical =
    (navigator.deviceMemory || 8) <= 4 ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    !!navigator.connection?.saveData;
  const renderer = new T.WebGLRenderer({
    antialias: !economical,
    powerPreference: "high-performance",
  });
  document.body.classList.add("walking");
  main.innerHTML = `<section id="walk" aria-label="${t("Recorrido 3D de")} ${esc(room.title)}"><div id="viewport" tabindex="0" aria-label="${t("WASD o flechas")}"></div>
    <div class="walk-top"><button id="leave" class="hud-btn">${icon("back")} <span>${t("Modo web")}</span></button><div class="walk-title">${esc(room.title)}<small>${esc(room.artist)}</small></div><button class="hud-btn" id="artist-card">${icon(room.id === "patio" ? "headphones" : "user")} <span>${t(room.id === "patio" ? "Música y créditos" : "Ficha del artista")}</span></button><button class="hud-btn" id="visits" aria-pressed="false">${icon("users")} <span>${t("Caminar en compañía")}</span></button>
    ${room.music ? `<button class="hud-btn" id="sound" aria-label="${t("Activar música")}" aria-pressed="false">${icon("mute")} <span>${t("Música")}</span></button>` : ""}<button class="hud-btn" id="help" aria-label="${t("Controles de movimiento")}">${icon("help")}</button></div>
    <div class="walk-bottom"><div class="walk-hint">${icon("move", 15)} ${t("WASD o flechas")} <b>·</b> ${t("Mové el mouse para mirar")}</div><button id="free-look" class="hud-btn">${icon("scan")} ${t("Mirar sin bordes")}</button><button id="inspect" class="primary" hidden>${icon("eye")} ${t("Ver obra")}</button></div>
    <div class="joystick" role="group" aria-label="${t("Joystick de movimiento")}"><span></span></div>
    </section>`;
  const state = new AbortController(),
    listen = (el, type, fn, opts = {}) =>
      el.addEventListener(type, fn, { ...opts, signal: state.signal });
  const view = $("#viewport");
  view.append(renderer.domElement);
  const maxRatio = Math.min(
    devicePixelRatio,
    economical ? 1 : matchMedia("(pointer:coarse)").matches ? 1.35 : 1.75,
  );
  let scale = maxRatio;
  renderer.setPixelRatio(scale);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const camera = new T.PerspectiveCamera(62, 1, 0.08, 65);
  camera.position.set(-1.35, 1.65, 6.6);
  camera.rotation.order = "YXZ";
  camera.lookAt(0.05, 1.83, -0.8);
  if (room.id === "patio") {
    camera.position.set(2.8, 1.72, 7.35);
    camera.lookAt(0, 2.74, -1.0);
  }
  const scene = new T.Scene();
  scene.background = new T.Color(0xd9d1c0);
  scene.fog = new T.FogExp2(0xd9d1c0, 0.024);
  let live = true,
    social = null,
    socialPending = false,
    music = null,
    near = null;
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };
  const drawnPosition = new T.Vector3(),
    drawnRotation = new T.Quaternion();
  const world =
      room.id === "patio"
        ? courtyard(scene, renderer, invalidate, economical)
        : room.curated
          ? exhibition(scene, renderer, camera, room, invalidate)
          : furnish(scene, renderer, room, () => live, invalidate),
    keys = new Set(),
    ray = new T.Raycaster(),
    point = new T.Vector2();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let dust =
    !economical &&
    !reducedMotion.matches &&
    (room.curated || room.id === "patio")
      ? lightDust(scene, room.id)
      : null;
  let slowFrames = 0,
    previousRender = 0;
  if (world.ready) {
    const loading = document.createElement("div");
    loading.className = "scene-loading";
    loading.setAttribute("role", "status");
    loading.textContent = t("Abriendo sala…");
    view.after(loading);
    world.ready.then(
      () => loading.remove(),
      () => {
        if (live) {
          exit();
          toast(t("Se interrumpió el 3D. Podés seguir en modo web."));
        }
      },
    );
  }
  $("#artist-card").onclick = () => {
    if (music && !music.paused) $("#sound")?.click();
    const works = room.works.filter((w) => w.ready !== false);
    panel(
      t(room.id === "patio" ? "Música y créditos" : "Obras y contacto"),
      (room.id === "patio" ? credit(room.recording) : profile(room)) +
        (works.length
          ? `<section class="artist-index"><h3>${t("Obras en sala")}</h3>${works.map((w, i) => `<button class="destination" data-piece="${i}"><span>${esc(w.title)}</span>${icon("arrow", 16)}</button>`).join("")}</section>`
          : ""),
    );
  };
  const experience =
    room.id === "intervalos" ? document.createElement("button") : null;
  if (experience) {
    experience.className = "primary film-control";
    experience.setAttribute("aria-pressed", "false");
    experience.innerHTML = icon("video") + " " + t("Ver la proyección");
    $("#inspect").before(experience);
    experience.onclick = async () => {
      try {
        const playing = await world.toggleFilm();
        experience.setAttribute("aria-pressed", String(playing));
        experience.innerHTML =
          icon("video") +
          " " +
          t(playing ? "Pausar proyección" : "Ver la proyección");
      } catch (e) {
        toast(failure(e));
      }
    };
  }
  function present(work) {
    if (work.type === "video" && experience) {
      experience.click();
      return;
    }
    if (work.type === "audio" && music && !music.paused) $("#sound")?.click();
    openPiece(work);
  }
  const doors = document.createElement("button");
  doors.className = "hud-btn";
  doors.setAttribute("aria-label", t("Cambiar de sala"));
  doors.innerHTML = icon("compass") + `<span>${t("Salas")}</span>`;
  $("#help").before(doors);
  const changeRoom = async () => {
    try {
      const { directory } = await import("./directory.js");
      if (live) directory(room.id);
    } catch (e) {
      toast(failure(e));
    }
  };
  doors.onclick = changeRoom;
  const chat = document.createElement("button");
  chat.className = "hud-btn";
  chat.textContent = t("Charla");
  chat.hidden = true;
  $("#help").before(chat);
  chat.onclick = () => {
    if (!social) return;
    panel(
      t("Conversación del grupo"),
      '<div class="conversation" id="walk-chat"></div>',
    );
    social.mount($("#walk-chat"), login);
    dialog.addEventListener("close", () => social?.unmount(), { once: true });
  };
  let atDoor = false;
  const resize = () => {
    scale = Math.min(
      scale,
      Math.sqrt(
        (economical ? 900000 : 2000000) /
          Math.max(1, view.clientWidth * view.clientHeight),
      ),
    );
    renderer.setPixelRatio(scale);
    renderer.setSize(view.clientWidth, view.clientHeight, false);
    camera.aspect = view.clientWidth / Math.max(view.clientHeight, 1);
    camera.updateProjectionMatrix();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(view);
  resize();
  const canMove = (x, z) =>
    Math.abs(x) < 7.56 &&
    Math.abs(z) < 8.5 &&
    !world.blocks.some(
      ([xmin, xmax, zmin, zmax]) =>
        x > xmin && x < xmax && z > zmin && z < zmax,
    );
  let drag = null,
    last = 0,
    frame = 0;
  function inspect(mode, event) {
    if (mode === "nearest") {
      if (atDoor) void changeRoom();
      else if (near) present(near.work);
      return;
    }
    const rect = view.getBoundingClientRect();
    point.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (document.pointerLockElement === view) point.set(0, 0);
    ray.setFromCamera(point, camera);
    const hit = ray.intersectObjects(world.targets.map((t) => t.frame))[0];
    const target = world.targets.find((t) => t.frame === hit?.object);
    if (target) present(target.work);
  }
  listen(view, "pointerdown", (e) => {
    if (e.button !== 0 || drag) return;
    if (e.pointerType !== "mouse") view.setPointerCapture(e.pointerId);
    view.focus();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dist: 0 };
  });
  function look(dx, dy) {
    camera.rotation.y -= dx * 0.0035;
    camera.rotation.x = T.MathUtils.clamp(
      camera.rotation.x - dy * 0.003,
      -1.2,
      1.2,
    );
  }
  let hover = null;
  listen(view, "pointerenter", () => {
    hover = null;
  });
  listen(view, "pointerleave", () => {
    hover = null;
    if (drag?.mouse) drag = null;
  });
  listen(view, "pointermove", (e) => {
    if (dialog.open || document.pointerLockElement === view) return;
    if (e.pointerType === "mouse") {
      if (hover) look(e.clientX - hover.x, e.clientY - hover.y);
      hover = { x: e.clientX, y: e.clientY };
    }
    if (drag?.id === e.pointerId) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.dist += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.mouse = e.pointerType === "mouse";
      if (!drag.mouse) look(dx, dy);
    }
  });
  listen(document, "mousemove", (e) => {
    if (!dialog.open && document.pointerLockElement === view)
      look(e.movementX, e.movementY);
  });
  const lock = $("#free-look");
  lock.hidden = !view.requestPointerLock;
  lock.onclick = async () => {
    try {
      await view.requestPointerLock();
    } catch {
      toast(t("Mové el mouse para mirar"));
    }
  };
  listen(document, "pointerlockchange", () => {
    $("#walk").classList.toggle("locked", document.pointerLockElement === view);
    hover = null;
  });
  listen(view, "pointerup", (e) => {
    if (drag?.id !== e.pointerId) return;
    if (drag.dist < 6) inspect("point", e);
    drag = null;
  });
  listen(view, "pointercancel", () => (drag = null));
  const movement = [
    "KeyW",
    "KeyS",
    "KeyA",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  listen(window, "keydown", (e) => {
    if (dialog.open) return;
    if (movement.includes(e.code)) {
      e.preventDefault();
      keys.add(e.code);
    }
    if (e.code === "KeyE" && !e.repeat) inspect("nearest");
  });
  listen(window, "keyup", (e) => keys.delete(e.code));
  listen(window, "blur", () => keys.clear());
  const joystick = bindJoystick($(".joystick"), listen);
  $("#inspect").onclick = () => inspect("nearest");
  $("#leave").onclick = exit;
  $("#help").onclick = () =>
    panel(
      t("Cómo recorrer la sala"),
      `<p>${t("En PC, mové el mouse para mirar y usá WASD para caminar. Podés activar la vista libre para girar sin llegar al borde de la pantalla. Escape libera el cursor. En el celular, usá el joystick izquierdo y mirá arrastrando con el otro pulgar. Tocá una obra para abrirla.")}</p>`,
    );
  $("#visits").onclick = async () => {
    if (socialPending) return;
    const b = $("#visits");
    if (social) {
      social.dispose();
      social = null;
      chat.hidden = true;
      invalidate();
      b.setAttribute("aria-pressed", "false");
      $("span", b).textContent = t("Caminar en compañía");
      return;
    }
    socialPending = true;
    b.disabled = true;
    try {
      const { joinVisitors } = await import("./social.js");
      if (!live) return;
      $("span", b).textContent = t("Conectando…");
      b.setAttribute("aria-pressed", "true");
      const session = await joinVisitors(
        room.id,
        scene,
        camera.position,
        () => camera.rotation.y,
        (m) => {
          if (live) $("span", b).textContent = m;
        },
        () => {
          social = null;
          chat.hidden = true;
          invalidate();
          if (live) {
            b.setAttribute("aria-pressed", "false");
            $("span", b).textContent = t("Volver a conectar");
          }
        },
      );
      if (!live) session.dispose();
      else {
        social = session;
        chat.hidden = false;
      }
    } catch (e) {
      b.setAttribute("aria-pressed", "false");
      $("span", b).textContent = t("Caminar en compañía");
      toast(failure(e));
    } finally {
      socialPending = false;
      b.disabled = false;
    }
  };
  if ($("#sound"))
    $("#sound").onclick = async () => {
      const b = $("#sound");
      if (!music) {
        music = new Audio(room.music);
        music.loop = true;
        music.volume = 0.48;
      }
      if (!music.paused) {
        music.pause();
        b.innerHTML = icon("mute") + `<span>${t("Música")}</span>`;
        b.setAttribute("aria-label", t("Activar música"));
        b.setAttribute("aria-pressed", "false");
      } else
        try {
          await music.play();
          b.innerHTML = icon("volume") + `<span>${t("Música")}</span>`;
          b.setAttribute("aria-label", t("Silenciar música"));
          b.setAttribute("aria-pressed", "true");
        } catch {
          toast(t("El navegador no pudo reproducir esta pista."));
        }
    };
  function draw(time) {
    const dt = Math.min((time - last) / 1000, 0.06);
    last = time;
    if (!dialog.open) {
      const f =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown")) +
        joystick.axis.y;
      const s =
        Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + joystick.axis.x;
      camera.rotation.y +=
        (Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"))) *
        dt *
        1.75;
      const speed = (dt * 3) / Math.max(1, Math.hypot(f, s)),
        a = camera.rotation.y,
        p = camera.position;
      const x = p.x + (s * Math.cos(a) - f * Math.sin(a)) * speed,
        z = p.z + (-f * Math.cos(a) - s * Math.sin(a)) * speed;
      if (canMove(x, p.z)) p.x = x;
      if (canMove(p.x, z)) p.z = z;
      world.approach?.(p, camera);
      near = null;
      let distance = 3.8 * 3.8;
      for (const target of world.targets) {
        const d = target.group.position.distanceToSquared(p);
        if (d < distance) {
          distance = d;
          near = target;
        }
      }
      const closeToDoor = world.portal.distanceTo(p) < 2.4;
      if (closeToDoor !== atDoor) {
        atDoor = closeToDoor;
        $("#inspect").innerHTML = atDoor
          ? icon("compass") + ` ${t("Cambiar sala")}`
          : icon("eye") + ` ${t("Ver obra")}`;
      }
      $("#inspect").hidden = !near && !atDoor;
      const peersMoved = social?.tick(time, dt);
      const recordMoved =
        !reducedMotion.matches &&
        world.rotateRecord?.(music && !music.paused ? music.currentTime : null);
      const atmosphereMoved = !reducedMotion.matches && dust?.tick(time);
      if (
        recordMoved ||
        atmosphereMoved ||
        dirty ||
        peersMoved ||
        world.animating?.() ||
        !drawnPosition.equals(camera.position) ||
        !drawnRotation.equals(camera.quaternion)
      ) {
        // Measure contiguous moving frames, excluding idle intervals and tab suspension.
        const moving =
          !drawnPosition.equals(camera.position) ||
          !drawnRotation.equals(camera.quaternion);
        const elapsed = time - previousRender;
        if (moving && previousRender && elapsed < 250) {
          slowFrames =
            elapsed > 39 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
          if (slowFrames >= 12) {
            const next = Math.max(Math.min(scale, 0.6), scale * 0.78);
            if (next < scale) {
              scale = next;
              renderer.setPixelRatio(scale);
            }
            dust?.dispose();
            dust = null;
            slowFrames = 0;
          }
        }
        previousRender = moving ? time : 0;
        if (atmosphereMoved) world.waterTime?.(time);
        renderer.render(scene, camera);
        drawnPosition.copy(camera.position);
        drawnRotation.copy(camera.quaternion);
        dirty = false;
      }
    } else {
      keys.clear();
      if (joystick.axis.x || joystick.axis.y) joystick.reset();
    }
    if (live && !document.hidden) frame = requestAnimationFrame(draw);
  }
  listen(document, "visibilitychange", () => {
    cancelAnimationFrame(frame);
    keys.clear();
    if (!document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  });
  listen(renderer.domElement, "webglcontextlost", (e) => {
    e.preventDefault();
    exit();
    toast(t("Se interrumpió el 3D. Podés seguir en modo web."));
  });
  view.focus();
  frame = requestAnimationFrame(draw);
  return () => {
    live = false;
    if (document.pointerLockElement === view) document.exitPointerLock();
    state.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    social?.dispose();
    music?.pause();
    dust?.dispose();
    world.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    document.body.classList.remove("walking");
  };
}
