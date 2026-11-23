import * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { art } from "./catalog.js";

function sculpture(room) {
  if (room.id === "frecuencia")
    return new T.TorusKnotGeometry(1.05, 0.25, 180, 18, 2, 3);
  const points = [],
    indices = [];
  const rings = 150,
    sides = 24;
  for (let i = 0; i < rings; i++) {
    const a = (2 * Math.PI * i) / rings,
      twist = 1.5 * a + 0.4;
    for (let j = 0; j < sides; j++) {
      const b = (2 * Math.PI * j) / sides,
        l = 0.48 * Math.cos(b),
        h = 0.16 * Math.sin(b);
      const r =
        1.35 * (1 + 0.15 * Math.cos(3 * a + 0.4)) +
        l * Math.cos(twist) -
        h * Math.sin(twist);
      points.push(
        r * Math.cos(a),
        r * Math.sin(a),
        -0.42 * Math.sin(2 * a + 0.5) -
          l * Math.sin(twist) -
          h * Math.cos(twist),
      );
      const next = (i + 1) % rings,
        shift = i === rings - 1 ? sides / 2 : 0;
      const p = i * sides + j,
        q = next * sides + ((j + shift) % sides),
        s = i * sides + ((j + 1) % sides),
        t = next * sides + ((j + 1 + shift) % sides);
      indices.push(p, q, s, s, q, t);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function surfaceTexture(wood) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d"),
    image = ctx.createImageData(256, 256);
  let seed = 372;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const grain = wood
        ? 10 * Math.sin(x * 0.46 + Math.sin(y * 0.035) + 3 * Math.sin(x * 0.05))
        : 2 * Math.sin(x * 0.08 + y * 0.06);
      const joint = wood ? x % 64 < 1 : x < 1 || y < 1;
      const v = 219 + grain + (seed / 4294967296 - 0.5) * 22 - (joint ? 28 : 0);
      const i = 4 * (y * 256 + x);
      image.data.set([v, v, v, 255], i);
    }
  ctx.putImageData(image, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
export function furnish(scene, renderer, r, isLive, invalidate) {
  const env = new RoomEnvironment(),
    generator = new T.PMREMGenerator(renderer),
    target = generator.fromScene(env, 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.58;
  env.dispose();
  generator.dispose();
  const material = (color, roughness = 0.78, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const wood = r.finish === "Madera",
    floor = material(
      wood ? 0x856246 : r.finish === "Basalto" ? 0x3e4143 : 0x837c70,
      0.52,
      0.09,
    );
  const tiles = surfaceTexture(wood);
  floor.map = tiles;
  const wall = material(r.wall_color),
    slats = material(0x65503e, 0.62),
    dark = material(0x282927, 0.52, 0.15),
    stone = material(0xc5b7a0, 0.55);
  const unit = new T.BoxGeometry(1, 1, 1);
  const loader = new T.TextureLoader();
  for (const [surface, file] of [
    [wall, "formwork.webp"],
    [stone, "travertine.webp"],
  ]) {
    surface.map = loader.load(art(file), invalidate);
    surface.map.colorSpace = T.SRGBColorSpace;
    surface.map.anisotropy = Math.min(
      4,
      renderer.capabilities.getMaxAnisotropy(),
    );
  }
  // Soft contact shadows supplement the single baked-in-place directional shadow map.
  const stamp = document.createElement("canvas");
  stamp.width = stamp.height = 128;
  const brush = stamp.getContext("2d"),
    shade = brush.createRadialGradient(64, 64, 4, 64, 64, 64);
  shade.addColorStop(0, "rgba(24,20,17,.68)");
  shade.addColorStop(0.55, "rgba(24,20,17,.48)");
  shade.addColorStop(1, "rgba(24,20,17,0)");
  brush.fillStyle = shade;
  brush.fillRect(0, 0, 128, 128);
  const contact = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(stamp),
    transparent: true,
    depthWrite: false,
  });
  function contactShadow(x, y, z, width, depth) {
    const p = new T.Mesh(new T.PlaneGeometry(width, depth), contact);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    scene.add(p);
  }
  function box(x, y, z, w, h, d, mat) {
    const mesh = new T.Mesh(unit, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function repeats(list, mat) {
    const mesh = new T.InstancedMesh(unit, mat, list.length),
      o = new T.Object3D();
    list.forEach(([x, y, z, w, h, d], i) => {
      o.position.set(x, y, z);
      o.scale.set(w, h, d);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
  box(0, -0.15, 0, 16, 0.3, 18, floor);
  box(0, 3, -9, 16, 6, 0.3, wall);
  box(-8, 3, 0, 0.28, 6, 18, wall);
  box(0, 3, 9, 16, 6, 0.28, wall);
  box(8, 0.45, 0, 0.3, 0.9, 18, wall);
  box(8, 5.5, 0, 0.3, 1, 18, wall);
  box(0, 6.1, 0, 16, 0.2, 18, material(0x817d73));
  repeats(
    Array.from({ length: 11 }, (_, i) => [
      0,
      5.78,
      -8.5 + i * 1.7,
      15.9,
      0.28,
      0.18,
    ]),
    material(0x989082, 0.82),
  );
  repeats(
    Array.from({ length: 10 }, (_, i) => [
      7.96,
      3,
      -8.6 + i * 1.9,
      0.33,
      6,
      0.16,
    ]),
    dark,
  );
  repeats(
    Array.from({ length: 44 }, (_, i) => [
      -7.65 + i * 0.136,
      3,
      -8.76,
      0.064,
      5.96,
      0.15,
    ]),
    slats,
  );
  const glow = new T.MeshBasicMaterial({ color: 0xffecd2 });
  const portal = new T.MeshBasicMaterial({ color: 0xd9fb87 });
  box(5.55, 1.43, -8.76, 1.68, 2.86, 0.18, dark);
  for (const x of [4.69, 6.41]) box(x, 1.45, -8.62, 0.055, 2.9, 0.08, portal);
  box(5.55, 2.92, -8.62, 1.77, 0.055, 0.08, portal);
  repeats(
    Array.from({ length: 8 }, (_, i) => [
      -6.7 + i * 1.9,
      5.95,
      -0.3,
      0.045,
      0.05,
      14,
    ]),
    glow,
  );
  // A luminous courtyard gives the window wall depth without transmitting shadows through glass.
  const landscape = material(0xb7ab93);
  repeats(
    Array.from({ length: 17 }, (_, i) => [
      15 + (i % 3) * 1.7,
      1.8 + (i % 4) * 0.27,
      -20 + i * 2.4,
      3,
      4 + (i % 4),
      0.95,
    ]),
    landscape,
  );
  box(15, -0.17, 0, 18, 0.3, 48, material(0xa19a7c));
  const sun = new T.DirectionalLight(0xffe6c6, 3.8);
  sun.position.set(12, 9, 4);
  sun.target.position.set(-2, 0, -2);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -14,
    right: 14,
    top: 13,
    bottom: -13,
    near: 0.2,
    far: 42,
  });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, new T.HemisphereLight(0xfff2df, 0x575654, 1.18));
  const blocks = [];
  if (r.curated) {
    contactShadow(0, 0.012, -0.84, 6.3, 3.9);
    box(0, 0.19, -0.85, 3.85, 0.38, 2.35, stone);
    contactShadow(0, 0.386, -0.85, 3.7, 1.6);
    blocks.push([-2.15, 2.15, -2.25, 0.55]);
    if (["orbital", "frecuencia"].includes(r.id)) {
      const object = new T.Mesh(
        sculpture(r),
        material(r.id === "orbital" ? 0xb9824c : 0x304dce, 0.25, 0.84),
      );
      object.material.side = T.DoubleSide;
      object.position.set(0, 2.06, -0.85);
      object.rotation.set(0.04, -0.33, r.id === "orbital" ? 0.12 : 0.4);
      object.castShadow = true;
      scene.add(object);
    } else if (r.id === "intervalos") {
      const rust = material(0xb95836, 0.48, 0.45);
      for (let i = 0; i < 8; i++) {
        const z = -1.83 + i * 0.26,
          x = i * 0.05 - 0.2;
        box(x - 1.1, 1.38, z, 0.11, 2, 0.12, rust);
        box(x + 1.1, 1.38, z, 0.11, 2, 0.12, rust);
        box(x, 2.37, z, 2.3, 0.14, 0.12, rust);
      }
    } else {
      for (let i = 0; i < 20; i++) {
        const b = box(
          -1.38 + i * 0.14,
          1.11 + 0.21 * Math.sin(i * 0.46),
          -0.87,
          0.105,
          1.48,
          1.43,
          stone,
        );
        b.rotation.z = 0.14 * Math.sin(i * 0.2);
      }
    }
  }
  box(4.1, 0.56, 1.8, 1.1, 0.14, 3.9, slats);
  contactShadow(4.1, 0.012, 1.8, 2.1, 5.4);
  box(4.1, 0.26, 0.45, 0.76, 0.52, 0.18, dark);
  box(4.1, 0.26, 3.15, 0.76, 0.52, 0.18, dark);
  blocks.push([3.3, 4.95, -0.45, 4.0]);
  const spots = [
    [-3.1, -8.68, 0],
    [2.4, -8.68, 0],
    [-7.65, -4.6, Math.PI / 2],
    [-7.65, 1, Math.PI / 2],
    [-7.65, 5.7, Math.PI / 2],
    [-3.8, 8.67, Math.PI],
    [1, 8.67, Math.PI],
    [5.6, 8.67, Math.PI],
  ];
  const works = r.works.filter((w) => w.ready !== false).slice(0, 8);
  const targets = [];
  works.forEach((w, i) => {
    const [x, z, yaw] = spots[w.slot ? w.slot - 1 : i],
      group = new T.Group();
    scene.add(group);
    group.position.set(x, 2.2, z);
    group.rotation.y = yaw;
    const label = document.createElement("canvas");
    label.width = 512;
    label.height = 110;
    const ink = label.getContext("2d");
    ink.fillStyle = "#e6e2d8";
    ink.fillRect(0, 0, 512, 110);
    ink.fillStyle = "#252821";
    ink.font = "bold 32px sans-serif";
    ink.fillText(w.title, 18, 43, 478);
    ink.font = "24px sans-serif";
    ink.fillText(r.artist, 18, 83, 478);
    const labelTexture = new T.CanvasTexture(label);
    labelTexture.colorSpace = T.SRGBColorSpace;
    const plate = new T.Mesh(
      new T.PlaneGeometry(0.68, 0.15),
      new T.MeshBasicMaterial({ map: labelTexture }),
    );
    plate.position.set(1.36, -1.31, 0.09);
    group.add(plate);
    const frame = new T.Mesh(new T.BoxGeometry(3.43, 2.37, 0.12), dark);
    frame.castShadow = true;
    group.add(frame);
    const backing = new T.Mesh(
      new T.PlaneGeometry(3.28, 2.22),
      material(0xe2d9c4),
    );
    backing.position.z = 0.065;
    group.add(backing);
    const face = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ color: 0xffffff }),
    );
    face.position.z = 0.074;
    group.add(face);
    const install = (tex) => {
      if (!isLive()) {
        tex.dispose();
        return;
      }
      tex.colorSpace = T.SRGBColorSpace;
      const ar = tex.image.width / tex.image.height;
      const width = Math.min(3.12, 2.06 * ar);
      face.scale.set(width, width / ar, 1);
      face.material.map = tex;
      face.material.needsUpdate = true;
      invalidate();
    };
    const placard = () => {
      const c = document.createElement("canvas");
      c.width = 768;
      c.height = 460;
      const g = c.getContext("2d");
      g.fillStyle = w.type === "audio" ? "#253854" : "#713f30";
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = "#e7ddc3";
      g.lineWidth = 3;
      for (let k = 0; k < 50; k++) {
        const h = 20 + 105 * Math.abs(Math.sin(k * 0.43) * Math.cos(k * 0.093));
        g.beginPath();
        g.moveTo(86 + k * 12, 204 - h / 2);
        g.lineTo(86 + k * 12, 204 + h / 2);
        g.stroke();
      }
      g.font = "30px sans-serif";
      g.fillStyle = "#fff";
      g.fillText(w.title, 60, 356, 640);
      install(new T.CanvasTexture(c));
    };
    if (w.type === "image") loader.load(w.url, install, undefined, placard);
    else placard();
    targets.push({ group, frame, work: w });
  });
  return {
    blocks,
    targets,
    portal: new T.Vector3(5.55, 1.4, -8.35),
    dispose: () => {
      target.dispose();
      tiles.dispose();
      const geo = new Set(),
        mats = new Set(),
        textures = new Set();
      scene.traverse((o) => {
        if (o.geometry) geo.add(o.geometry);
        if (o.material) {
          for (const m of [].concat(o.material)) {
            mats.add(m);
            if (m.map) textures.add(m.map);
          }
        }
      });
      for (const t of textures) t.dispose();
      for (const m of mats) m.dispose();
      for (const g of geo) g.dispose();
      sun.shadow.dispose();
    },
  };
}
