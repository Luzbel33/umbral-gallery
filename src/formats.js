import {t} from "./i18n.js";
export const codeExtensions =
  "txt md markdown rst json jsonl ndjson csv tsv yaml yml toml ini cfg conf log xml svg html htm css scss sass less js jsx mjs cjs ts tsx vue svelte astro py ipynb r rmd java kt kts swift c h cpp cc cxx hpp cs go rs rb php lua sh bash zsh ps1 sql graphql gql dart scala clj cljs ex exs erl hs fs fsharp sol gd glsl vert frag wgsl asm tex diff patch dockerfile makefile".split(
    " ",
  );
export const models = ["glb", "gltf", "obj", "stl", "ply"];
export const fileAccept = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  ".mp4",
  ".webm",
  ".mov",
  ".ogv",
  ".mp3",
  ".ogg",
  ".opus",
  ".wav",
  ".m4a",
  ".flac",
  ".pdf",
  ...models.map((x) => "." + x),
  ...codeExtensions.map((x) => "." + x),
].join(",");
export const suffix = (name) => (name || "").toLowerCase().split(".").pop();
export function workType(ext) {
  if (ext === "webp") return "image";
  if (["mp4", "webm", "mov", "ogv"].includes(ext)) return "video";
  if (ext === "mesh") return "model";
  if (ext === "txt") return "source";
  if (ext === "pdf") return "document";
  return "audio";
}
export const typeLabels = {
  image: t("Imagen"),
  video: "Video",
  audio: "Audio",
  model: t("Modelo 3D"),
  source: t("Texto o código"),
  document: t("Documento PDF"),
};
export function safeLink(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export async function readBounded(url, limit, signal) {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok || Number(response.headers.get("content-length")) > limit)
    throw Error(t("No se pudo abrir este archivo dentro del límite del visor."));
  const reader = response.body.getReader(),
    chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw Error(t("El archivo supera el límite del visor."));
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
