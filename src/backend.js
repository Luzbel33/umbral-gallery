import { createClient } from "@supabase/supabase-js";
import { projectUrl, publicKey } from "./config.js";
import { adaptRoom, pathFor } from "./catalog.js";
import { models, codeExtensions, suffix } from "./formats.js";
export const client = createClient(projectUrl, publicKey);
const bucket = client.storage.from("gallery-art");
const fields =
  "id,title,artist,description,category,wall_color,finish,music_slot,website,social_url,project_url,published,created_at,works(id,room_id,slot,title,extension,ready,source_name)";
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
export async function rooms({ category, ids, offset = 0, limit = 12 } = {}) {
  let q = client
    .from("gallery_catalog")
    .select("id,title,artist,category,wall_color,cover_id")
    .order("created_at", { ascending: false })
    .order("id");
  if (category) q = q.eq("category", category);
  if (ids) q = q.in("id", ids);
  return unwrap(await q.range(offset, offset + limit - 1)).map((r) => ({
    ...r,
    cover: r.cover_id
      ? bucket.getPublicUrl(r.id + "/" + r.cover_id + ".webp").data.publicUrl
      : null,
  }));
}
export async function readRoom(id) {
  const row = unwrap(
    await client.from("rooms").select(fields).eq("id", id).maybeSingle(),
  );
  return row ? adaptRoom(row, bucket) : null;
}
export async function saveRoom(id, values) {
  return unwrap(
    await client
      .from("rooms")
      .update(values)
      .eq("id", id)
      .select("id")
      .single(),
  );
}
const mediaTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};
async function prepare(file) {
  if (file.size > 12 * 1024 * 1024)
    throw Error("El máximo es 12 MB por archivo.");
  const ext = suffix(file.name);
  if (models.includes(ext)) {
    const { convertMesh } = await import("./mesh.js");
    return {
      blob: await convertMesh(file, ext),
      extension: "mesh",
      mime: "application/octet-stream",
    };
  }
  if (codeExtensions.includes(ext)) {
    if (file.size > 524288)
      throw Error("El máximo para código y texto es de 512 KiB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw Error("Elegí un archivo de texto UTF-8.");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw Error("Guardá el texto en UTF-8.");
    }
    return { blob: file, extension: "txt", mime: "text/plain" };
  }
  if (ext === "pdf") {
    if (!(await file.slice(0, 5).text()).startsWith("%PDF-"))
      throw Error("El archivo no tiene cabecera PDF.");
    return { blob: file, extension: "pdf", mime: "application/pdf" };
  }
  const other = {
    flac: ["flac", "audio/flac"],
    opus: ["ogg", "audio/ogg"],
    ogg: ["ogg", "audio/ogg"],
    wav: ["wav", "audio/wav"],
    mp3: ["mp3", "audio/mpeg"],
    m4a: ["m4a", "audio/mp4"],
    mp4: ["mp4", "video/mp4"],
    webm: ["webm", "video/webm"],
    ogv: ["ogv", "video/ogg"],
    mov: ["mov", "video/quicktime"],
  }[ext];
  if (other) return { blob: file, extension: other[0], mime: other[1] };
  if (
    ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp"].includes(ext) ||
    [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/bmp",
    ].includes(file.type)
  ) {
    const bitmap = await createImageBitmap(file);
    try {
      const s = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * s));
      canvas.height = Math.max(1, Math.round(bitmap.height * s));
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.86),
      );
      if (!blob || blob.type !== "image/webp")
        throw Error("Este navegador no pudo convertir la imagen.");
      return { blob, extension: "webp", mime: blob.type };
    } finally {
      bitmap.close();
    }
  }
  const extension = mediaTypes[file.type];
  if (!extension)
    throw Error(
      "Este formato todavía no tiene un visor. Consultá la lista de formatos.",
    );
  const mime =
    extension === "wav"
      ? "audio/wav"
      : extension === "m4a"
        ? "audio/mp4"
        : file.type;
  return { blob: file, extension, mime };
}
export async function uploadWork(room, file, title) {
  const { blob, extension, mime } = await prepare(file);
  const slot = Array.from({ length: 8 }, (_, i) => i + 1).find(
    (n) => !room.works.some((w) => w.slot === n),
  );
  if (!slot) throw Error("Tu sala ya tiene ocho obras.");
  const w = {
    id: crypto.randomUUID(),
    room_id: room.id,
    slot,
    title,
    extension,
    source_name: file.name.slice(-120),
  };
  unwrap(await client.from("works").insert(w));
  try {
    unwrap(
      await bucket.upload(pathFor(w), blob.slice(0, blob.size, mime), {
        contentType: mime,
        cacheControl: "31536000",
      }),
    );
    unwrap(
      await client
        .from("works")
        .update({ ready: true })
        .eq("id", w.id)
        .select("id")
        .single(),
    );
  } catch (e) {
    // The editor also exposes incomplete reservations after a network interruption.
    await deleteWork(w).catch(() => {});
    throw e;
  }
}
export async function deleteWork(w) {
  unwrap(await bucket.remove([pathFor(w)]));
  unwrap(
    await client.from("works").delete().eq("id", w.id).select("id").single(),
  );
}
export async function placeWork(id, destination) {
  unwrap(await client.rpc("place_gallery_work", { work_key: id, destination }));
}
