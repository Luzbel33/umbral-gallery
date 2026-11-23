import { t } from "./i18n.js";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { decodeMesh } from "./mesh.js";
export function geometryFrom(bytes) {
  const { positions, colors } = decodeMesh(bytes);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(positions, 3));
  g.setAttribute("color", new T.BufferAttribute(colors, 3, true));
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new T.Vector3()),
    scale = 2 / Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(scale) || scale > 1e10) {
    g.dispose();
    throw Error(t("La malla no tiene volumen visible."));
  }
  g.center();
  g.scale(scale, scale, scale);
  g.computeVertexNormals();
  return g;
}
export function showModel(el, bytes, orientation = 0) {
  const geometry = geometryFrom(bytes),
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  el.innerHTML = `<p>${t("Arrastrá para girar. Usá dos dedos o la rueda para acercarte.")}</p>`;
  el.append(renderer.domElement);
  renderer.domElement.className = "model-canvas";
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(38, 1, 0.03, 40);
  camera.position.set(2.2, 1.7, 3.2);
  const mat = new T.MeshStandardMaterial({
    vertexColors: true,
    side: T.DoubleSide,
    roughness: 0.62,
  });
  const model = new T.Mesh(geometry, mat);
  model.rotation.y = T.MathUtils.degToRad(orientation);
  scene.add(model, new T.HemisphereLight(0xffffff, 0x676e88, 2));
  const lamp = new T.DirectionalLight(0xffe8cb, 3);
  lamp.position.set(2, 4, 3);
  scene.add(lamp);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.minDistance = 1.3;
  orbit.maxDistance = 8;
  orbit.enablePan = false;
  const draw = () => renderer.render(scene, camera);
  orbit.addEventListener("change", draw);
  orbit.update();
  const resize = () => {
    const c = renderer.domElement,
      w = c.clientWidth,
      h = c.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(el);
  resize();
  return () => {
    observer.disconnect();
    orbit.dispose();
    geometry.dispose();
    mat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
