import { t } from "./i18n.js";
import { createClient } from "@supabase/supabase-js";
import { projectUrl, publicKey } from "./config.js";
import { summary, objectUrl } from "./public-gallery.js";
import {
  summaryFields,
  roomFields,
} from "../supabase/functions/_shared/catalog.js";
import { adaptRoom, pathFor, previewPath } from "./catalog.js";
import { models, codeExtensions, suffix } from "./formats.js";
export const client = createClient(projectUrl, publicKey);
const bucket = client.storage.from("gallery-art");
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
export async function favoriteRooms({ category, ids, offset = 0, limit = 13 }) {
  let q = client
    .from("gallery_catalog")
    .select(summaryFields)
    .in("id", ids)
    .order("created_at", { ascending: false })
    .order("id");
  if (category) q = q.eq("category", category);
  return unwrap(await q.range(offset, offset + limit - 1)).map(summary);
}
export async function readRoom(id) {
  const row = unwrap(
    await client.from("rooms").select(roomFields).eq("id", id).maybeSingle(),
  );
  return row ? adaptRoom(row, objectUrl) : null;
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
export async function prepare(
  file,
  { available = 32 * 1024 ** 2, optimize = true, progress, signal } = {},
) {
  const ext = suffix(file.name),
    av = [
      "flac",
      "opus",
      "ogg",
      "wav",
      "mp3",
      "m4a",
      "mp4",
      "mov",
      "ogv",
      "webm",
    ].includes(ext);
  const max = av ? 128 : models.includes(ext) ? 12 : 32;
  if (file.size > max * 1024 ** 2)
    throw Error(
      t("Este original supera el límite de preparación.") + " " + max + " MiB.",
    );
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
      throw Error(t("El máximo para código y texto es de 512 KiB."));
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw Error(t("Elegí un archivo de texto UTF-8."));
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw Error(t("Guardá el texto en UTF-8."));
    }
    return { blob: file, extension: "txt", mime: "text/plain" };
  }
  if (ext === "pdf") {
    if (!(await file.slice(0, 5).text()).startsWith("%PDF-"))
      throw Error(t("El archivo no tiene cabecera PDF."));
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
  if (other) {
    const limit = Math.min(32 * 1024 ** 2, available);
    if (
      optimize &&
      file.size >
        Math.min(
          limit,
          ["wav", "flac", "mov"].includes(ext) ? 256 * 1024 : 2 * 1024 ** 2,
        )
    ) {
      const { compressMedia } = await import("./prepare-media.js");
      const compressed = await compressMedia(
        file,
        other[1].startsWith("video/"),
        limit,
        progress,
        signal,
      );
      if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
      if (compressed) return compressed;
    }
    if (file.size > limit)
      throw Error(
        t(
          "Este archivo no entra con la calidad disponible en este navegador. Podés usar una versión más liviana o un enlace.",
        ),
      );
    return { blob: file, extension: other[0], mime: other[1] };
  }
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
        throw Error(t("Este navegador no pudo convertir la imagen."));
      let preview = null;
      if (blob.size > 24576) {
        const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas
          .getContext("2d")
          .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const small = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/webp", 0.66),
        );
        if (
          small?.type === "image/webp" &&
          small.size < blob.size &&
          small.size <= 65536
        )
          preview = small;
      }
      return { blob, preview, extension: "webp", mime: blob.type };
    } finally {
      bitmap.close();
    }
  }
  const extension = mediaTypes[file.type];
  if (!extension)
    throw Error(
      t(
        "Este formato todavía no tiene un visor. Consultá la lista de formatos.",
      ),
    );
  const mime =
    extension === "wav"
      ? "audio/wav"
      : extension === "m4a"
        ? "audio/mp4"
        : file.type;
  return { blob: file, extension, mime };
}
export async function uploadWork(room, file, title, prepared) {
  const { blob, preview, extension, mime } = prepared || (await prepare(file));
  if (room.works.length >= 4) throw Error("PILOT_WORKS_FULL");
  if (
    blob.size > 32 * 1024 ** 2 ||
    blob.size + (preview?.size || 0) > room.available
  )
    throw Error("PILOT_BYTES_FULL");
  const slot = Array.from({ length: 8 }, (_, i) => i + 1).find(
    (n) => !room.works.some((w) => w.slot === n),
  );
  if (!slot) throw Error("PILOT_WORKS_FULL");
  const w = {
    id: crypto.randomUUID(),
    room_id: room.id,
    slot,
    title,
    extension,
    has_preview: !!preview,
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
    if (preview)
      unwrap(
        await bucket.upload(previewPath(w), preview, {
          contentType: "image/webp",
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
  if (!w.external_url)
    unwrap(
      await bucket.remove(
        w.has_preview ? [pathFor(w), previewPath(w)] : [pathFor(w)],
      ),
    );
  unwrap(
    await client.from("works").delete().eq("id", w.id).select("id").single(),
  );
}
export async function saveWork(id, slot, w) {
  unwrap(
    await client.rpc("mount_gallery_work", {
      work_key: id,
      destination: slot,
      work_title: w.title,
      work_medium: w.medium,
      work_year: w.year,
      work_caption: w.caption,
      work_angle: w.orientation,
    }),
  );
}
export async function studioRoom(id) {
  const [room, usage] = await Promise.all([
    readRoom(id),
    client.rpc("my_gallery_budget"),
  ]);
  if (room) {
    const budget = unwrap(usage);
    room.bytes = Number(budget.used);
    room.available = Number(budget.available);
  }
  return room;
}
