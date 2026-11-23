import * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { art } from "./catalog.js";
import { surfaceTexture } from "./architecture.js";

export function courtyard(scene, renderer, invalidate, economical = false) {
  scene.background = new T.Color(0x252b2b);
  scene.fog = new T.FogExp2(0x313433, 0.016);
  const studio = new RoomEnvironment(),
    generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.045);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.79;
  studio.dispose();
  generator.dispose();
  const texture = new T.TextureLoader().load(
    art("travertine.webp"),
    invalidate,
  );
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(4, 2);
  const floorTiles = surfaceTexture(false);
  floorTiles.repeat.set(12, 12);
  const stone = new T.MeshStandardMaterial({
    color: 0x40524f,
    map: texture,
    roughness: 0.62,
    bumpMap: texture,
    bumpScale: 0.035,
  });
  const basalt = new T.MeshStandardMaterial({
    color: 0x484846,
    roughness: 0.46,
    metalness: 0.14,
  });
  const paving = basalt.clone();
  paving.map = floorTiles;
  paving.bumpMap = floorTiles;
  paving.bumpScale = 0.034;
  const brass = new T.MeshStandardMaterial({
    color: 0xc38b51,
    metalness: 0.85,
    roughness: 0.25,
  });
  const champagne = new T.MeshStandardMaterial({
    color: 0xedd4a6,
    metalness: 0.85,
    roughness: 0.2,
  });
  const velvet = new T.MeshStandardMaterial({
    color: 0xb06943,
    roughness: 0.84,
  });
  const amber = new T.MeshBasicMaterial({
    color: new T.Color(1, 0.6, 0.25).multiplyScalar(2.0),
  });
  const alabaster = new T.MeshBasicMaterial({
    color: new T.Color(1, 0.75, 0.46).multiplyScalar(1.6),
    map: texture,
  });
  const cube = new T.BoxGeometry(),
    rounded = new RoundedBoxGeometry(1, 1, 1, 2, 0.095),
    circle = new T.CylinderGeometry(1, 1, 1, 96);
  const bounds = [];
  function box(x, y, z, w, h, d, material, geometry = cube) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function batch(transforms, material, geometry = cube) {
    const mesh = new T.InstancedMesh(geometry, material, transforms.length),
      o = new T.Object3D();
    transforms.forEach(([x, y, z, w, h, d, rx = 0, ry = 0, rz = 0], i) => {
      o.position.set(x, y, z);
      o.scale.set(w, h, d);
      o.rotation.set(rx, ry, rz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function cylinder(x, y, z, r, h, m, wall = false) {
    const mesh = box(x, y, z, r, h, r, m, circle);
    if (wall) mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  box(0, -0.12, 0, 18, 0.24, 19, paving);
  box(0, 4.1, -8.8, 17.4, 8.2, 0.42, stone);
  box(0, 4.1, 9.05, 17.4, 8.2, 0.4, stone);
  box(0, 8.1, 0, 17.4, 0.25, 19, stone);
  const brassRibs = [],
    darkRibs = [],
    lightStrips = [];
  for (const side of [-1, 1]) {
    box(side * 8.1, 4.1, 0, 0.3, 8.2, 19, stone);
    for (let i = 0; i < 25; i++) {
      const z = 7.9 - i * 0.65;
      brassRibs.push([side * 7.8, 4, z, 0.42, 8, 0.13]);
      if (i % 4 === 0)
        lightStrips.push([side * 7.56, 3.7, z, 0.028, 6.8, 0.055]);
    }
    for (let i = 0; i < 18; i++)
      darkRibs.push([side * (3.8 + i * 0.22), 4, -8.46, 0.095, 8, 0.16]);
  }
  for (let i = 0; i < 12; i++) {
    const z = 7 - i * 1.34;
    darkRibs.push([0, 7.8, z, 16, 0.35, 0.13]);
    lightStrips.push([0, 7.6, z, 12, 0.035, 0.05]);
  }
  batch(brassRibs, brass);
  batch(darkRibs, basalt);
  batch(lightStrips, amber);
  cylinder(0, 3.85, -8.46, 3.28, 0.14, brass, true);
  cylinder(0, 3.85, -8.34, 3.11, 0.13, alabaster, true);
  cylinder(0, 0.14, -0.45, 3.05, 0.28, brass);
  const waterGeometry = new T.CircleGeometry(2.94, 96);
  const water = economical
    ? new T.Mesh(
        waterGeometry,
        new T.MeshStandardMaterial({
          color: 0x315353,
          metalness: 0.72,
          roughness: 0.19,
        }),
      )
    : new Reflector(waterGeometry, {
        clipBias: 0.005,
        color: 0x9dbdb8,
        textureWidth: 512,
        textureHeight: 512,
      });
  if (!economical) {
    const mat = water.material;
    mat.uniforms.waterTime = { value: 0 };
    mat.vertexShader =
      "varying vec2 surfacePoint;\n" +
      mat.vertexShader.replace(
        "vUv = textureMatrix",
        "surfacePoint = position.xy; vUv = textureMatrix",
      );
    mat.fragmentShader =
      "varying vec2 surfacePoint; uniform float waterTime;\n" +
      mat.fragmentShader.replace(
        "vec4 base = texture2DProj( tDiffuse, vUv );",
        "vec4 uv=vUv; uv.xy+=uv.w*.0018*vec2(sin(6.0*surfacePoint.y+waterTime),cos(5.0*surfacePoint.x-waterTime*.8)); vec4 base=texture2DProj(tDiffuse,uv);",
      );
    const reflect = water.onBeforeRender,
      lastView = new T.Matrix4();
    let lastReflection = 0;
    water.onBeforeRender = function (renderer, scene, camera, ...args) {
      const now = performance.now();
      if (lastView.equals(camera.matrixWorld) && now - lastReflection < 700)
        return;
      lastView.copy(camera.matrixWorld);
      lastReflection = now;
      reflect.call(this, renderer, scene, camera, ...args);
    };
  }
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.292, -0.45);
  scene.add(water);
  // Rectangles follow the round pool rim so the diagonal passages stay open.
  for (let i = 0; i < 12; i++) {
    const x = -3.05 + ((i + 0.5) * 6.1) / 12,
      z = Math.sqrt(3.05 ** 2 - x * x);
    bounds.push([x - 0.46, x + 0.46, -0.45 - z - 0.16, -0.45 + z + 0.16]);
  }
  for (const x of [-4.8, 4.8])
    for (const z of [1, -3.4]) {
      box(x, 0.26, z, 1.05, 0.52, 2.6, basalt, rounded);
      box(x, 0.59, z, 1.05, 0.22, 2.65, velvet, rounded);
      bounds.push([x - 0.72, x + 0.72, z - 1.53, z + 1.53]);
    }
  const spine = [];
  const goldFins = [],
    paleFins = [];
  for (let i = 0; i < 120; i++) {
    const a = (i * Math.PI) / 60;
    const fin = [
      2.05 * Math.cos(a),
      3.23 + 1.58 * Math.sin(a) + 0.28 * Math.sin(2 * a),
      -0.45 - 0.79 * Math.sin(2 * a + 0.35),
      0.057,
      0.62,
      0.53,
      0.42 + 1.15 * Math.sin(a + 0.2),
      0.47 * Math.sin(2 * a),
      a - 0.24,
    ];
    spine.push(new T.Vector3(...fin.slice(0, 3)));
    (i % 6 < 2 ? paleFins : goldFins).push(fin);
  }
  const rail = new T.TubeGeometry(
    new T.CatmullRomCurve3(spine, true),
    120,
    0.063,
    8,
    true,
  );
  scene.add(new T.Mesh(rail, brass));
  // Three tension rods connect the installation to the ceiling structure.
  for (const a of [0.63, 1.62, 2.5]) {
    const x = 2.05 * Math.cos(a),
      z = -0.45 - 0.79 * Math.sin(2 * a + 0.35),
      y = 3.23 + 1.58 * Math.sin(a) + 0.28 * Math.sin(2 * a);
    cylinder(x, (7.99 + y) / 2, z, 0.021, 7.99 - y, champagne);
    cylinder(x, 7.94, z, 0.095, 0.1, brass);
  }
  batch(goldFins, brass, economical ? cube : rounded);
  batch(paleFins, champagne, economical ? cube : rounded);
  const ambient = new T.HemisphereLight(0xffedc6, 0x699294, 1.05);
  const sun = new T.DirectionalLight(0xffdcab, 2.5);
  sun.position.set(-3.5, 7.5, 3.8);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
  });
  sun.shadow.mapSize.set(economical ? 512 : 1024, economical ? 512 : 1024);
  sun.shadow.normalBias = 0.025;
  const cool = new T.PointLight(0x90dceb, 85, 16, 2);
  cool.position.set(5, 3, -3);
  const glow = new T.PointLight(0xffb371, 145, 18, 2);
  glow.position.set(-0.6, 3.9, -6);
  scene.add(ambient, sun, cool, glow);
  const portal = new T.Vector3(6.1, 1.4, -7.75);
  box(6.1, 1.4, -8.1, 1.75, 2.8, 0.3, brass);
  box(6.1, 1.42, -7.93, 1.5, 2.51, 0.05, basalt);
  box(6.1, 2.7, -7.89, 1.5, 0.04, 0.04, amber);
  return {
    waterTime(time) {
      if (!economical) water.material.uniforms.waterTime.value = time * 0.001;
    },
    blocks: bounds,
    targets: [],
    portal,
    dispose() {
      if (economical) water.material.dispose();
      else water.dispose();
      waterGeometry.dispose();
      rail.dispose();
      texture.dispose();
      floorTiles.dispose();
      environment.dispose();
      sun.shadow.dispose();
      for (const g of [cube, rounded, circle]) g.dispose();
      for (const m of [
        stone,
        basalt,
        paving,
        brass,
        champagne,
        velvet,
        amber,
        alabaster,
      ])
        m.dispose();
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
    },
  };
}
