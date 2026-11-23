import {t} from "./i18n.js";
import { Matrix4, Quaternion, Vector3 } from "three";
const maxFaces = 60000,
  palette = [0.67, 0.75, 0.56];
const bad = () => {
  throw Error(
    t("Modelo incompatible. Usá una malla estática de hasta 60.000 triángulos, con sus datos incluidos en el archivo."),
  );
};
function collector() {
  const positions = [],
    colors = [];
  return {
    face(a, b, c, color = palette) {
      if (
        positions.length >= maxFaces * 9 ||
        ![a, b, c].every(
          (p) =>
            p?.length === 3 &&
            p.every((n) => Number.isFinite(n) && Math.abs(n) < 1e10),
        )
      )
        bad();
      positions.push(...a, ...b, ...c);
      colors.push(
        ...color
          .slice(0, 3)
          .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)),
      );
    },
    finish() {
      const faces = colors.length / 3;
      if (!faces) bad();
      const data = new ArrayBuffer(8 + faces * 39),
        dv = new DataView(data);
      dv.setUint32(0, 0x554d4231);
      dv.setUint32(4, faces, true);
      new Float32Array(data, 8, faces * 9).set(positions);
      new Uint8Array(data, 8 + faces * 36).set(colors);
      return new Blob([data], { type: "application/octet-stream" });
    },
  };
}
export function decodeMesh(bytes) {
  if (bytes.byteLength < 47 || bytes.byteLength > 8 + maxFaces * 39) bad();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    n = dv.getUint32(4, true);
  if (
    dv.getUint32(0) !== 0x554d4231 ||
    n < 1 ||
    n > maxFaces ||
    bytes.length !== 8 + n * 39
  )
    bad();
  const p = new Float32Array(bytes.buffer, bytes.byteOffset + 8, n * 9);
  if (!p.every((v) => Number.isFinite(v) && Math.abs(v) < 1e10)) bad();
  const colors = new Uint8Array(n * 9),
    src = bytes.subarray(8 + n * 36);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 3; j++)
      colors.set(src.subarray(i * 3, i * 3 + 3), i * 9 + j * 3);
  return { positions: p, colors };
}
function parseObj(text, out) {
  const vertices = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      if (vertices.length >= 200000) bad();
      vertices.push(line.split(/\s+/).slice(1, 4).map(Number));
    } else if (line.startsWith("f ")) {
      const refs = line.slice(2).trim().split(/\s+/);
      if (refs.length > 4096) bad();
      const points = refs.map((ref) => {
        const i = Number(ref.split("/")[0]);
        return vertices[i < 0 ? vertices.length + i : i - 1];
      });
      for (let i = 1; i + 1 < points.length; i++)
        out.face(points[0], points[i], points[i + 1]);
    }
  }
}
function parsePly(text, out) {
  const lines = text.split(/\r?\n/),
    end = lines.findIndex((s) => s.trim() === "end_header");
  if (
    end < 0 ||
    end > 150 ||
    !lines.slice(0, end).some((s) => s.trim() === "format ascii 1.0")
  )
    bad();
  let vertices = 0,
    faces = 0,
    section = "",
    props = [];
  for (const line of lines.slice(0, end)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "element") {
      section = t[1];
      if (section === "vertex") vertices = +t[2];
      if (section === "face") faces = +t[2];
    } else if (section === "vertex" && t[0] === "property")
      props.push(t.at(-1));
  }
  if (vertices < 1 || vertices > 200000 || faces > maxFaces) bad();
  const coord = ["x", "y", "z"].map((k) => props.indexOf(k));
  if (coord.includes(-1)) bad();
  const p = lines.slice(end + 1, end + 1 + vertices).map((l) => {
    const a = l.trim().split(/\s+/);
    return coord.map((k) => +a[k]);
  });
  for (const line of lines.slice(
    end + 1 + vertices,
    end + 1 + vertices + faces,
  )) {
    const a = line.trim().split(/\s+/).map(Number);
    if (a[0] !== a.length - 1 || a[0] > 4096) bad();
    for (let i = 2; i < a.length - 1; i++)
      out.face(p[a[1]], p[a[i]], p[a[i + 1]]);
  }
}
function parseGltf(bytes, ext, out) {
  const dv = new DataView(bytes.buffer);
  let doc, bin;
  if (ext === "glb") {
    if (
      bytes.length < 20 ||
      dv.getUint32(0, true) !== 0x46546c67 ||
      dv.getUint32(4, true) !== 2 ||
      dv.getUint32(8, true) !== bytes.length ||
      dv.getUint32(16, true) !== 0x4e4f534a
    )
      bad();
    const end = 20 + dv.getUint32(12, true);
    if (
      end + 8 > bytes.length ||
      dv.getUint32(end + 4, true) !== 0x004e4942 ||
      end + 8 + dv.getUint32(end, true) !== bytes.length
    )
      bad();
    doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, end)));
    bin = bytes.subarray(end + 8);
  } else doc = JSON.parse(new TextDecoder().decode(bytes));
  if (
    doc.asset?.version !== "2.0" ||
    doc.extensionsRequired?.length ||
    doc.skins?.length ||
    (doc.nodes?.length || 0) > 512
  )
    bad();
  const buffers = (doc.buffers || []).map((info, i) => {
    if (!info.uri && i === 0 && bin) return bin;
    if (
      !/^data:application\/(?:octet-stream|gltf-buffer);base64,/.test(
        info.uri || "",
      )
    )
      bad();
    return Uint8Array.from(atob(info.uri.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
  });
  function accessor(index, position) {
    const a = doc.accessors?.[index],
      v = doc.bufferViews?.[a?.bufferView],
      buf = buffers[v?.buffer],
      sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 },
      size = sizes[a?.componentType],
      dim = position ? 3 : 1;
    if (
      !buf ||
      !size ||
      a.sparse ||
      a.type !== (position ? "VEC3" : "SCALAR") ||
      (position ? a.componentType !== 5126 : a.componentType === 5126) ||
      a.count > 180000 ||
      !Number.isInteger(a.count) ||
      a.count < 1
    )
      bad();
    const base = v.byteOffset || 0,
      offset = a.byteOffset || 0,
      stride = v.byteStride || size * dim;
    if (
      ![base, offset, stride, v.byteLength].every(
        (x) => Number.isInteger(x) && x >= 0,
      ) ||
      stride < size * dim ||
      offset + (a.count - 1) * stride + size * dim > v.byteLength ||
      base + v.byteLength > buf.length
    )
      bad();
    const d = new DataView(buf.buffer, buf.byteOffset + base, v.byteLength);
    return {
      count: a.count,
      get(i) {
        if (!Number.isInteger(i) || i < 0 || i >= a.count) bad();
        const at = offset + i * stride;
        if (position)
          return new Vector3(
            d.getFloat32(at, true),
            d.getFloat32(at + 4, true),
            d.getFloat32(at + 8, true),
          );
        return size === 1
          ? d.getUint8(at)
          : size === 2
            ? d.getUint16(at, true)
            : d.getUint32(at, true);
      },
    };
  }
  const seen = new Set();
  function node(index, parent) {
    if (seen.has(index) || seen.size >= 512) bad();
    seen.add(index);
    const n = doc.nodes[index];
    if (!n) bad();
    const m = n.matrix
      ? new Matrix4().fromArray(n.matrix)
      : new Matrix4().compose(
          new Vector3(...(n.translation || [0, 0, 0])),
          new Quaternion(...(n.rotation || [0, 0, 0, 1])),
          new Vector3(...(n.scale || [1, 1, 1])),
        );
    m.premultiply(parent);
    if (n.mesh != null) {
      for (const p of doc.meshes[n.mesh].primitives) {
        if ((p.mode ?? 4) !== 4) continue;
        const pos = accessor(p.attributes.POSITION, true),
          indices = p.indices != null ? accessor(p.indices, false) : null,
          count = indices?.count ?? pos.count;
        if (count % 3 !== 0) bad();
        const color =
          doc.materials?.[p.material]?.pbrMetallicRoughness?.baseColorFactor ||
          palette;
        for (let i = 0; i < count; i += 3) {
          const pts = [0, 1, 2].map((j) =>
            pos
              .get(indices ? indices.get(i + j) : i + j)
              .applyMatrix4(m)
              .toArray(),
          );
          out.face(...pts, color);
        }
      }
    }
    for (const c of n.children || []) node(c, m);
  }
  const roots = doc.scenes?.[doc.scene ?? 0]?.nodes;
  if (!roots) bad();
  for (const n of roots) node(n, new Matrix4());
}
export async function convertMesh(file, ext) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    out = collector(),
    decode = () => new TextDecoder().decode(bytes);
  if (ext === "obj" || ext === "ply") {
    let lines = 1,
      width = 0;
    for (const byte of bytes) {
      if (byte === 10) {
        if (++lines > 300000) bad();
        width = 0;
      } else if (++width > 120000) bad();
    }
  }
  if (ext === "obj") parseObj(decode(), out);
  else if (ext === "ply") parsePly(decode(), out);
  else if (ext === "stl") {
    const d = new DataView(bytes.buffer),
      n = bytes.length >= 84 ? d.getUint32(80, true) : 0;
    if (n && 84 + 50 * n === bytes.length) {
      if (n > maxFaces) bad();
      for (let i = 0; i < n; i++) {
        const start = 84 + i * 50 + 12;
        out.face(
          ...[0, 1, 2].map((j) =>
            [0, 1, 2].map((k) => d.getFloat32(start + j * 12 + k * 4, true)),
          ),
        );
      }
    } else {
      let points = [];
      for (const m of decode().matchAll(
        /^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)/gim,
      )) {
        points.push(m.slice(1, 4).map(Number));
        if (points.length === 3) {
          out.face(...points);
          points = [];
        }
      }
      if (points.length) bad();
    }
  } else parseGltf(bytes, ext, out);
  return out.finish();
}
