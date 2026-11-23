import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { art } from "./catalog.js";
import { sculpture } from "./architecture.js";
import { readBounded } from "./formats.js";

const settings = {
  frecuencia: {
    eye: [2.75, 2.03, 0.78],
    at: [0, 1.28, -4.9],
    blocks: [
      [-2.18, 2.18, -5.94, -3.64],
      [-6.76, -5.18, -6.5, -3.15],
      [5.18, 6.76, -6.5, -3.15],
      [-4.16, -2.6, -5.8, -4.28],
      [2.6, 4.16, -5.8, -4.28],
    ],
  },
  intervalos: {
    eye: [1.4, 1.72, 4.7],
    at: [0, 2.8, -8.4],
    blocks: [-4.4, 4.4].flatMap((x) =>
      [0.7, 3.5].map((z) => [x - 1.6, x + 1.6, z - 0.7, z + 0.93]),
    ),
  },
  estratos: {
    eye: [-2.7, 1.72, 2.5],
    at: [0.55, 2.46, -8.6],
    blocks: [[-3.55, 3.55, -0.82, 0.82]],
  },
  orbital: {
    eye: [-1.8, 1.7, 5.3],
    at: [0, 1.98, -1],
    blocks: [[-2.23, 2.23, -2.67, 0.68]],
  },
};
function release(root) {
  const materials = new Set(),
    geometries = new Set(),
    textures = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) for (const m of [].concat(o.material)) materials.add(m);
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    m.dispose();
  }
  for (const tex of textures) {
    tex.dispose();
    tex.source.data?.close?.();
  }
  for (const geo of geometries) geo.dispose();
}
export function exhibition(scene, renderer, camera, room, invalidate) {
  const config = settings[room.id],
    group = new T.Group(),
    targets = [],
    controller = new AbortController();
  const hitMaterial = new T.MeshBasicMaterial({ visible: false });
  let environment, film, screen, frameCallback;
  function placard(title, subtitle, x, y, z, width, angle = 0) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 236;
    const ink = c.getContext("2d");
    ink.fillStyle = "#242526";
    ink.fillRect(0, 0, 1024, 236);
    ink.fillStyle = "#d1aa75";
    ink.fillRect(26, 25, 4, 186);
    ink.font = "500 35px sans-serif";
    ink.fillText(subtitle, 64, 80, 915);
    ink.fillStyle = "#faf2e4";
    ink.font = "56px Georgia,serif";
    ink.fillText(title, 62, 164, 910);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sign = new T.Mesh(
      new T.PlaneGeometry(width, (width * 236) / 1024),
      new T.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    sign.position.set(x, y, z);
    sign.rotation.y = angle;
    group.add(sign);
  }
  if (room.id === "frecuencia")
    placard("Cylinders", "CHRIS ZABRISKIE   /   2014", 0, 1.12, -4.022, 0.69);
  if (room.id === "intervalos")
    placard(room.works[0].title, room.artist, 5.83, 1.67, -8.926, 1.62);
  if (room.id === "orbital")
    placard(room.title, room.artist, 0, 0.25, 0.377, 1.42);
  if (room.id === "estratos")
    room.works.forEach((w, i) =>
      placard(
        w.title,
        room.artist,
        [-4.86, 0, 4.86][i] + 0.85,
        0.72,
        -8.926,
        1.44,
      ),
    );
  let recordFace;
  if (room.id === "frecuencia") {
    const c = document.createElement("canvas");
    c.width = c.height = 320;
    const ink = c.getContext("2d");
    ink.fillStyle = "#1a1a1b";
    ink.fillRect(0, 0, 320, 320);
    for (let r = 52; r < 158; r += 2.7) {
      ink.strokeStyle = r % 3 < 1.5 ? "#3b383a" : "#26262b";
      ink.lineWidth = 0.7;
      ink.beginPath();
      ink.arc(160, 160, r, 0, 2 * Math.PI);
      ink.stroke();
    }
    ink.fillStyle = "#c49760";
    ink.beginPath();
    ink.arc(160, 160, 46, 0, 2 * Math.PI);
    ink.fill();
    ink.fillStyle = "#30271c";
    ink.textAlign = "center";
    ink.font = "13px Georgia";
    ink.fillText("CYLINDERS", 160, 147);
    ink.fillRect(157, 157, 6, 6);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    recordFace = new T.Mesh(
      new T.CircleGeometry(0.43, 64),
      new T.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    recordFace.rotation.x = -Math.PI / 2;
    recordFace.position.set(-0.34, 1.563, -4.88);
    group.add(recordFace);
  }
  async function toggleFilm() {
    if (!film) {
      film = document.createElement("video");
      film.playsInline = true;
      film.loop = true;
      film.preload = "none";
      film.src = room.works[0].url;
      const tex = new T.VideoTexture(film);
      tex.colorSpace = T.SRGBColorSpace;
      screen = new T.Mesh(
        new T.PlaneGeometry(6.06, 4.04),
        new T.MeshBasicMaterial({
          map: tex,
          toneMapped: false,
          color: 0xf4ede0,
        }),
      );
      screen.position.set(0, 3, -8.395);
      screen.visible = false;
      group.add(screen);
    }
    if (!film.paused) {
      film.pause();
      return false;
    }
    await film.play();
    if (controller.signal.aborted) {
      film.pause();
      return false;
    }
    screen.visible = true;
    invalidate();
    if (film.requestVideoFrameCallback) {
      const next = () => {
        invalidate();
        if (!film.paused && !controller.signal.aborted)
          frameCallback = film.requestVideoFrameCallback(next);
      };
      film.cancelVideoFrameCallback(frameCallback || 0);
      frameCallback = film.requestVideoFrameCallback(next);
    }
    return true;
  }
  scene.add(group, new T.HemisphereLight(0xffe7cc, 0x8f837f, 1.4));
  scene.background = new T.Color(
    room.id === "intervalos" ? 0x211618 : 0x24252a,
  );
  scene.fog = null;
  camera.position.set(...config.eye);
  camera.lookAt(...config.at);
  function hit(work, x, y, z, w, h, d) {
    const frame = new T.Mesh(new T.BoxGeometry(w, h, d), hitMaterial);
    group.add(frame);
    frame.position.set(x, y, z);
    targets.push({ group: frame, frame, work });
  }
  if (room.id === "frecuencia")
    hit(room.works[0], 0, 1.0, -4.9, 3.85, 1.7, 1.48);
  if (room.id === "intervalos") hit(room.works[0], 0, 3, -8.4, 9.6, 4.04, 0.08);
  if (room.id === "estratos")
    room.works.forEach((w, i) =>
      hit(w, [-4.86, 0, 4.86][i], 2.63, -8.62, 3.58, 3.38, 0.1),
    );
  if (room.id === "orbital") {
    const lighting = new RoomEnvironment(),
      gen = new T.PMREMGenerator(renderer);
    environment = gen.fromScene(lighting, 0.04);
    scene.environment = environment.texture;
    lighting.dispose();
    gen.dispose();
    const piece = new T.Mesh(
      sculpture(),
      new T.MeshStandardMaterial({
        color: 0xb9814a,
        roughness: 0.22,
        metalness: 0.88,
        side: T.DoubleSide,
      }),
    );
    piece.position.set(0, 2.12, -1);
    piece.rotation.set(0.04, -0.33, 0.12);
    group.add(piece);
    piece.updateMatrixWorld(true);
    piece.position.y += 0.458 - new T.Box3().setFromObject(piece, true).min.y;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d"),
      shade = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
    shade.addColorStop(0, "rgba(58,34,18,.58)");
    shade.addColorStop(0.5, "rgba(55,32,17,.23)");
    shade.addColorStop(1, "rgba(51,28,15,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 128, 128);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(3.4, 1.3),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.462, -1);
    group.add(shadow);
    targets.push({ group: piece, frame: piece, work: room.works[0] });
    const key = new T.DirectionalLight(0xffe1b3, 3.9);
    key.position.set(4, 5, 2);
    scene.add(key);
  }
  if (room.id === "estratos") {
    const loader = new T.TextureLoader();
    room.works.forEach((work, i) =>
      loader.load(work.preview, (texture) => {
        if (controller.signal.aborted) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        const print = new T.Mesh(
          new T.PlaneGeometry(3.02, 3.02),
          new T.MeshBasicMaterial({
            map: texture,
            color: 0xf7f3e9,
            toneMapped: false,
          }),
        );
        print.position.set([-4.86, 0, 4.86][i], 2.63, -8.631);
        group.add(print);
        invalidate();
      }),
    );
  }
  const ready = readBounded(
    art("room-" + room.id + ".glb"),
    3 * 1024 * 1024,
    controller.signal,
  )
    .then((bytes) => new GLTFLoader().parseAsync(bytes.buffer, ""))
    .then(({ scene: model }) => {
      if (controller.signal.aborted) {
        release(model);
        return;
      }
      let textured = true;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        const map = old.emissiveMap || old.map;
        if (!map) textured = false;
        o.material = new T.MeshBasicMaterial({
          map,
          side: old.side,
          toneMapped: false,
        });
        o.material.color.setScalar(
          room.id === "intervalos"
            ? 0.46
            : room.id === "estratos"
              ? 0.77
              : 0.86,
        );
        old.dispose();
      });
      if (!textured) {
        release(model);
        throw Error("Missing exhibition light atlas");
      }
      group.add(model);
      invalidate();
    });
  return {
    ready,
    rotateRecord(seconds) {
      if (!recordFace || seconds == null) return false;
      const angle = (-Math.floor(seconds * 15) / 15) * ((Math.PI * 10) / 9);
      if (recordFace.rotation.z === angle) return false;
      recordFace.rotation.z = angle;
      return true;
    },
    toggleFilm: room.id === "intervalos" ? toggleFilm : null,
    animating: () => film && !film.paused && !film.requestVideoFrameCallback,
    blocks: config.blocks,
    targets,
    portal: new T.Vector3(0, 1.5, 8.6),
    dispose() {
      controller.abort();
      if (film) {
        film.pause();
        film.removeAttribute("src");
        film.load();
        film.cancelVideoFrameCallback?.(frameCallback || 0);
      }
      release(group);
      hitMaterial.dispose();
      environment?.dispose();
    },
  };
}
