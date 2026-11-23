import * as T from "three";
import { furnish } from "./architecture.js";
import { courtyard } from "./courtyard.js";
import { icon } from "./icons.js";
import { $, esc, dialog, panel, toast, failure } from "./ui.js";
import "./walk.css";
export function enterWalk(room, { exit, openPiece, login }) {
  const main = $("#main");
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  document.body.classList.add("walking");
  main.innerHTML = `<section id="walk" aria-label="Recorrido 3D de ${esc(room.title)}"><div id="viewport" tabindex="0" aria-label="Moverse con WASD o flechas. Arrastrar para mirar."></div>
    <div class="walk-top"><button id="leave" class="hud-btn">${icon("back")} <span>Modo web</span></button><div class="walk-title">${esc(room.title)}<small>${esc(room.artist)}</small></div><button class="hud-btn" id="visits" aria-pressed="false">${icon("users")} <span>Caminar en compañía</span></button>
    ${room.music ? `<button class="hud-btn" id="sound" aria-label="Activar música" aria-pressed="false">${icon("mute")}</button>` : ""}<button class="hud-btn" id="help" aria-label="Controles de movimiento">${icon("help")}</button></div>
    <div class="walk-bottom"><div class="walk-hint">${icon("move", 15)} WASD o flechas <b>·</b> Arrastrá para mirar</div><button id="inspect" class="primary" hidden>${icon("eye")} Ver obra</button></div>
    <div class="dpad" aria-label="Controles táctiles">${[
      ["KeyW", "↑", "Avanzar"],
      ["KeyA", "←", "Izquierda"],
      ["KeyS", "↓", "Retroceder"],
      ["KeyD", "→", "Derecha"],
    ]
      .map(
        ([k, t, l]) =>
          `<button data-step="${k}" aria-label="${l}">${t}</button>`,
      )
      .join("")}</div>
    </section>`;
  const state = new AbortController(),
    listen = (el, type, fn, opts = {}) =>
      el.addEventListener(type, fn, { ...opts, signal: state.signal });
  const view = $("#viewport");
  view.append(renderer.domElement);
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      matchMedia("(pointer:coarse)").matches ? 1.35 : 1.75,
    ),
  );
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
        ? courtyard(scene, renderer, invalidate)
        : furnish(scene, renderer, room, () => live, invalidate),
    keys = new Set(),
    ray = new T.Raycaster(),
    point = new T.Vector2();
  const doors = document.createElement("button");
  doors.className = "hud-btn";
  doors.setAttribute("aria-label", "Cambiar de sala");
  doors.innerHTML = icon("compass");
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
  chat.textContent = "Charla";
  chat.hidden = true;
  $("#help").before(chat);
  chat.onclick = () => {
    if (!social) return;
    panel(
      "Conversación del grupo",
      '<div class="conversation" id="walk-chat"></div>',
    );
    social.mount($("#walk-chat"), login);
    dialog.addEventListener("close", () => social?.unmount(), { once: true });
  };
  let atDoor = false;
  const resize = () => {
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
      else if (near) openPiece(near.work);
      return;
    }
    const rect = view.getBoundingClientRect();
    point.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(point, camera);
    const hit = ray.intersectObjects(world.targets.map((t) => t.frame))[0];
    const target = world.targets.find((t) => t.frame === hit?.object);
    if (target) openPiece(target.work);
  }
  listen(view, "pointerdown", (e) => {
    if (e.button !== 0) return;
    view.setPointerCapture(e.pointerId);
    view.focus();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dist: 0 };
  });
  listen(view, "pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.dist += Math.abs(dx) + Math.abs(dy);
    camera.rotation.y -= dx * 0.005;
    camera.rotation.x = T.MathUtils.clamp(
      camera.rotation.x - dy * 0.004,
      -1.15,
      1.15,
    );
  });
  listen(view, "pointerup", (e) => {
    if (drag?.id === e.pointerId && drag.dist < 6) inspect("point", e);
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
  document.querySelectorAll("[data-step]").forEach((b) => {
    listen(b, "pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      keys.add(b.dataset.step);
    });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
      listen(b, ev, () => keys.delete(b.dataset.step));
  });
  $("#inspect").onclick = () => inspect("nearest");
  $("#leave").onclick = exit;
  $("#help").onclick = () =>
    panel(
      "Cómo recorrer la sala",
      "<p>Usá W y S para avanzar o retroceder, A y D para desplazarte de lado, y las flechas laterales para girar. Arrastrá para mirar alrededor. Tocá una obra, o acercate y presioná E para abrirla. En el celular, usá las flechas en pantalla.</p>",
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
      $("span", b).textContent = "Caminar en compañía";
      return;
    }
    socialPending = true;
    b.disabled = true;
    try {
      const { joinVisitors } = await import("./social.js");
      if (!live) return;
      $("span", b).textContent = "Conectando…";
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
            $("span", b).textContent = "Volver a conectar";
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
      $("span", b).textContent = "Caminar en compañía";
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
        b.innerHTML = icon("mute");
        b.setAttribute("aria-label", "Activar música");
        b.setAttribute("aria-pressed", "false");
      } else
        try {
          await music.play();
          b.innerHTML = icon("volume");
          b.setAttribute("aria-label", "Silenciar música");
          b.setAttribute("aria-pressed", "true");
        } catch {
          toast("El navegador no pudo reproducir esta pista.");
        }
    };
  function draw(time) {
    const dt = Math.min((time - last) / 1000, 0.06);
    last = time;
    if (!dialog.open) {
      const f =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const s = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
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
      world.approach?.(p);
      near = world.targets.find((t) => t.group.position.distanceTo(p) < 3.8);
      const closeToDoor = world.portal.distanceTo(p) < 2.4;
      if (closeToDoor !== atDoor) {
        atDoor = closeToDoor;
        $("#inspect").innerHTML = atDoor
          ? icon("compass") + " Cambiar sala"
          : icon("eye") + " Ver obra";
      }
      $("#inspect").hidden = !near && !atDoor;
      const peersMoved = social?.tick(time, dt);
      if (
        dirty ||
        peersMoved ||
        !drawnPosition.equals(camera.position) ||
        !drawnRotation.equals(camera.quaternion)
      ) {
        renderer.render(scene, camera);
        drawnPosition.copy(camera.position);
        drawnRotation.copy(camera.quaternion);
        dirty = false;
      }
    } else keys.clear();
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
    toast("Se interrumpió el 3D. Podés seguir en modo web.");
  });
  view.focus();
  frame = requestAnimationFrame(draw);
  return () => {
    live = false;
    state.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    social?.dispose();
    music?.pause();
    world.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    document.body.classList.remove("walking");
  };
}
