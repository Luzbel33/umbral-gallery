import { createClient } from "@supabase/supabase-js";
import { projectUrl, publicKey } from "./config.js";
import { adaptRoom, pathFor } from "./catalog.js";
export const client = createClient(projectUrl, publicKey);
const bucket = client.storage.from("gallery-art");
const fields =
  "id,title,artist,description,category,wall_color,finish,music_slot,published,created_at,works(id,room_id,slot,title,extension,ready)";
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
export async function rooms({ category, ids, offset = 0, limit = 12 } = {}) {
  let q = client
    .from("rooms")
    .select(fields)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .order("id");
  if (category) q = q.eq("category", category);
  if (ids) q = q.in("id", ids);
  return unwrap(await q.range(offset, offset + limit - 1)).map((r) =>
    adaptRoom(r, bucket),
  );
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
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
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
      "Elegí una imagen JPG, PNG o WebP, video MP4 o WebM, o audio MP3, Ogg, WAV o M4A.",
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
  };
  unwrap(await client.from("works").insert(w));
  try {
    unwrap(
      await bucket.upload(pathFor(w), blob, {
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
