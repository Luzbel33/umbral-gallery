import { workshop } from "./catalog.js";
import { workType } from "./formats.js";

const draft = structuredClone(workshop);
export function exampleRoom() {
  const works = [...draft.works].sort((a, b) => a.slot - b.slot);
  const photo = works.find((w) => w.ready && w.type === "image");
  const track = draft.works.find(
    (w) => w.slot === draft.music_slot && w.type === "audio",
  );
  const used = draft.works.reduce((a, w) => a + (w.bytes || 0), 0);
  return {
    ...draft,
    bytes: used,
    available: 48 * 1024 ** 2 - used,
    works,
    cover: photo?.preview || photo?.url,
    thumb: photo?.preview || photo?.url,
    music: track?.url,
    recording: track?.id === "track" ? workshop.recording : null,
  };
}
export function saveExample(values) {
  Object.assign(draft, values, { published: true });
}
export function editExample(id, values) {
  Object.assign(
    draft.works.find((w) => w.id === id),
    values,
  );
}
export function moveExample(id, to) {
  const w = draft.works.find((w) => w.id === id),
    other = draft.works.find((w) => w.slot === to),
    from = w.slot;
  if (other) other.slot = from;
  w.slot = to;
  if (draft.music_slot === from) draft.music_slot = to;
  else if (draft.music_slot === to) draft.music_slot = from;
}
export async function uploadExample(room, file, title, prepared) {
  const { prepare } = await import("./backend.js");
  const { blob, preview, extension } = prepared || (await prepare(file));
  if (room.works.length >= 4) throw Error("PILOT_WORKS_FULL");
  const stored = blob.size + (preview?.size || 0);
  if (blob.size > 32 * 1024 ** 2 || stored > room.available)
    throw Error("PILOT_BYTES_FULL");
  const slot = Array.from({ length: 8 }, (_, i) => i + 1).find(
    (s) => !draft.works.some((w) => w.slot === s),
  );
  if (!slot) throw Error("PILOT_WORKS_FULL");
  draft.works.push({
    id: crypto.randomUUID(),
    slot,
    title,
    bytes: stored,
    source_name: file.name,
    type: workType(extension),
    ready: true,
    url: URL.createObjectURL(blob),
    preview: preview ? URL.createObjectURL(preview) : null,
  });
}
export function linkExample(title, link) {
  if (draft.works.length >= 4) throw Error("PILOT_WORKS_FULL");
  const slot = Array.from({ length: 8 }, (_, i) => i + 1).find(
    (s) => !draft.works.some((w) => w.slot === s),
  );
  draft.works.push({
    id: crypto.randomUUID(),
    slot,
    title,
    type: link.type,
    url: link.url,
    external_url: link.url,
    ready: true,
  });
}
export function deleteExample(w) {
  for (const url of [w.url, w.preview])
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  draft.works = draft.works.filter((item) => item.id !== w.id);
  if (draft.music_slot === w.slot) draft.music_slot = null;
}
