import * as T from "three";
import { art } from "./catalog.js";
import { surfaceTexture } from "./architecture.js";
export function courtyard(scene, renderer, invalidate) {
  scene.background = new T.Color(0xc1d6dc);
  scene.fog = new T.FogExp2(0xd5d4c3, 0.024);
  const cube = new T.BoxGeometry(1, 1, 1),
    stone = new T.MeshStandardMaterial({ color: 0xc6aa85 }),
    wood = new T.MeshStandardMaterial({ color: 0x986c46 }),
    sage = new T.MeshStandardMaterial({ color: 0x768458 }),
    cloth = new T.MeshStandardMaterial({ color: 0xb57449 }),
    water = new T.MeshStandardMaterial({
      color: 0x4e9180,
      metalness: 0.28,
      roughness: 0.2,
    });
  const loader = new T.TextureLoader();
  const travertine = loader.load(art("travertine.webp"), invalidate);
  travertine.colorSpace = T.SRGBColorSpace;
  travertine.wrapS = travertine.wrapT = T.RepeatWrapping;
  travertine.repeat.set(3, 2);
  stone.map = travertine;
  stone.bumpMap = travertine;
  stone.bumpScale = 0.045;
  const grain = surfaceTexture(true);
  wood.map = grain;
  wood.roughness = 0.64;
  const paving = stone.clone(),
    tile = surfaceTexture(false);
  tile.repeat.set(14, 13);
  paving.map = tile;
  sage.side = T.DoubleSide;
  sage.color.set(0xffffff);
  const blocks = [];
  function box(x, y, z, w, h, d, m) {
    const o = new T.Mesh(cube, m);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.castShadow = o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  function block(x, z, w, d) {
    blocks.push([
      x - w / 2 - 0.22,
      x + w / 2 + 0.22,
      z - d / 2 - 0.22,
      z + d / 2 + 0.22,
    ]);
  }
  box(0, -0.1, 0, 19, 0.2, 20, paving);
  box(0, 1.65, -9, 19, 3.3, 0.35, stone);
  for (const x of [-8, 8]) box(x, 0.6, 0, 0.3, 1.2, 18, stone);
  for (const x of [-6, -2, 2, 6]) box(x, 1.9, -5, 0.16, 3.8, 0.2, wood);
  box(0, 3.87, -4.3, 16, 0.22, 0.2, wood);
  for (let i = 0; i < 30; i++)
    box(-7.7 + i * 0.53, 4, -5, 0.16, 0.19, 4.3, wood);
  box(-2, 0.1, -1, 4.8, 0.2, 3, stone);
  const pool = box(-2, 0.205, -1, 4.48, 0.04, 2.7, water);
  block(-2, -1, 4.8, 3);
  for (const [x, z] of [
    [3, -1],
    [3, -5],
    [-5, -5],
    [-4, 3],
  ]) {
    box(x, 0.31, z, 2.5, 0.62, 0.82, stone);
    box(x, 0.66, z, 2.46, 0.12, 0.8, cloth);
    block(x, z, 2.5, 0.82);
  }
  const leaf = new T.BufferGeometry();
  leaf.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [0, 0, 0, 0.22, 0.07, 0.44, 0, 0, 1, -0.22, 0.07, 0.44],
      3,
    ),
  );
  leaf.setIndex([0, 1, 2, 0, 2, 3]);
  leaf.computeVertexNormals();
  const leaves = new T.InstancedMesh(leaf, sage, 3 * 16 * 80),
    branchesGeometry = new T.CylinderGeometry(0.5, 1, 1, 7),
    branches = new T.InstancedMesh(branchesGeometry, wood, 3 * 17),
    dummy = new T.Object3D(),
    up = new T.Vector3(0, 1, 0);
  let n = 0,
    limbs = 0,
    seed = 46;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function limb(start, end, width) {
    const dir = end.clone().sub(start);
    dummy.position.copy(start).lerp(end, 0.5);
    dummy.scale.set(width, dir.length(), width);
    dummy.quaternion.setFromUnitVectors(up, dir.normalize());
    dummy.updateMatrix();
    branches.setMatrixAt(limbs++, dummy.matrix);
  }
  for (const [x, z, h] of [
    [3, -3, 3.2],
    [-6, -6, 2.9],
    [6, -6, 3.6],
  ]) {
    const root = new T.Vector3(x, 0, z),
      fork = new T.Vector3(x + 0.16, h * 0.52, z - 0.12);
    limb(root, fork, 0.15);
    block(x, z, 0.45, 0.45);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4,
        r = 0.35 + 1.15 * random(),
        end = new T.Vector3(
          x + Math.cos(a) * r,
          h + 0.55 * (1 - r / 1.5) + random() * 0.4,
          z + Math.sin(a) * r,
        );
      limb(fork, end, 0.045);
      for (let j = 0; j < 80; j++) {
        const theta = random() * Math.PI * 2,
          rad = Math.sqrt(random()) * 0.78,
          height = random() - 0.5;
        dummy.position.set(
          end.x + Math.cos(theta) * rad,
          end.y + height * 0.86,
          end.z + Math.sin(theta) * rad,
        );
        dummy.rotation.set((random() - 0.5) * 1.55, theta, random() * 0.8);
        dummy.scale.setScalar(0.1 + random() * 0.17);
        dummy.updateMatrix();
        leaves.setMatrixAt(n, dummy.matrix);
        leaves.setColorAt(
          n++,
          new T.Color().setHSL(
            0.2 + random() * 0.035,
            0.19 + random() * 0.16,
            0.18 + random() * 0.24,
            T.SRGBColorSpace,
          ),
        );
      }
    }
  }
  leaves.castShadow = true;
  branches.castShadow = branches.receiveShadow = leaves.receiveShadow = true;
  scene.add(leaves, branches);
  const sun = new T.DirectionalLight(0xffe3bf, 3);
  sun.position.set(-8, 11, 5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
  });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.025;
  scene.add(sun, new T.HemisphereLight(0xfff2df, 0x85916f, 1.6));
  const portal = new T.Vector3(5.8, 1.4, -8.2);
  box(5.8, 1.3, -8.7, 1.4, 2.6, 0.3, wood);
  const reflection = new T.WebGLCubeRenderTarget(128, {
    generateMipmaps: true,
    minFilter: T.LinearMipmapLinearFilter,
  });
  const probe = new T.CubeCamera(0.1, 48, reflection);
  probe.position.set(-2, 0.32, -1);
  pool.visible = false;
  probe.update(renderer, scene);
  pool.visible = true;
  water.envMap = reflection.texture;
  water.metalness = 0.78;
  water.roughness = 0.1;
  water.bumpMap = grain;
  water.bumpScale = 0.028;
  return {
    blocks,
    targets: [],
    portal,
    dispose() {
      cube.dispose();
      leaf.dispose();
      leaves.dispose();
      branches.dispose();
      branchesGeometry.dispose();
      reflection.dispose();
      travertine.dispose();
      grain.dispose();
      tile.dispose();
      for (const m of [wood, stone, cloth, water, sage, paving]) m.dispose();
      sun.shadow.dispose();
    },
  };
}
