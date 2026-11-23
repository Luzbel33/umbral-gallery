import { projectUrl } from "./config.js";
import { adaptRoom } from "./catalog.js";
import { t } from "./i18n.js";
const pending = new Map();
export const objectUrl = (path) =>
  projectUrl + "/storage/v1/object/public/gallery-art/" + path;
export function summary(row) {
  return {
    ...row,
    cover:
      row.cover_url ||
      (row.cover_id
        ? objectUrl(
            row.id +
              "/" +
              row.cover_id +
              (row.cover_preview ? ".preview.webp" : ".webp"),
          )
        : null),
  };
}
export async function readPublicJSON(url) {
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(5500),
      });
      if (response.ok) return response.json();
      if (![429, 502, 503, 504].includes(response.status)) break;
    } catch {
      if (attempt === 1) break;
    }
    if (!attempt) {
      const retry = Math.min(
        4,
        Number(response?.headers.get("Retry-After")) || 0.4,
      );
      await new Promise((done) =>
        setTimeout(done, (retry + Math.random()) * 1000),
      );
    }
  }
  throw Error(
    t(
      response?.status === 503
        ? "La galería está ocupada. Volvé a intentarlo en un momento."
        : "No se pudo cargar la sala. Probá de nuevo o explorá las exposiciones inaugurales.",
    ),
  );
}
function publicRows(params) {
  const url =
    projectUrl + "/functions/v1/gallery-public?" + new URLSearchParams(params);
  if (!pending.has(url))
    pending.set(
      url,
      readPublicJSON(url).finally(() => pending.delete(url)),
    );
  return pending.get(url);
}
export async function rooms({ category, cursor } = {}) {
  const query = {};
  if (category) query.category = category;
  if (cursor) {
    query.after = cursor.created_at;
    query.id = cursor.id;
  }
  return (await publicRows(query)).map(summary);
}
export async function publicRoom(id) {
  const row = (await publicRows({ room: id }))[0];
  return row ? adaptRoom(row, objectUrl) : null;
}
