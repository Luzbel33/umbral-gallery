import { t } from "./i18n.js";
const root = import.meta.env?.BASE_URL || "/umbral-gallery/";
export const art = (name) => root + "art/" + name;
const entries = [
  [
    "orbital",
    "Materia orbital",
    "Escultura",
    "Pliegues de bronce suspendidos entre el peso y el vacío.",
    "#a69a8b",
    "Piedra",
  ],
  [
    "frecuencia",
    "Frecuencia azul",
    "Música",
    "Una cabina de escucha de nogal y fieltro azul, dedicada al piano y las texturas de Chris Zabriskie.",
    "#465795",
    "Basalto",
  ],
  [
    "intervalos",
    "Intervalos",
    "Video",
    "Una microcinemateca de terciopelo oscuro para un estudio de movimiento y luz.",
    "#ad543a",
    "Basalto",
  ],
  [
    "estratos",
    "Estratos de luz",
    "Fotografía",
    "El delta del Paraná, el río Colorado y los Andes vistos desde el espacio. Tres paisajes de la colección Earth As Art.",
    "#c8ab88",
    "Madera",
  ],
];
export const recordings = {
  five: { title: "Cylinder Five", url: art("cylinder-05.mp3") },
  six: { title: "Cylinder Six", url: art("cylinder-06.mp3") },
};
const work = (title, type, file) => ({
  title: t(title),
  type,
  url: art(file),
  ...(file.startsWith("earth-")
    ? { preview: art(file.replace(".webp", "-preview.webp")) }
    : {}),
});
const collections = [
  [
    work("Materia orbital · Vista frontal", "image", "orbital.webp"),
    work("El espacio entre los pliegues", "image", "orbital-wide.webp"),
  ],
  [{ ...recordings.five, type: "audio" }],
  [
    work("Tránsito", "video", "transito.mp4"),
    work("Intervalos · Fotograma", "image", "intervalos.webp"),
  ],
  [
    work("Delta del Paraná", "image", "earth-parana_delta_0.webp"),
    work("Sabotage", "image", "earth-sabotage.webp"),
    work("Andes", "image", "earth-andes_0.webp"),
  ],
];
export const exhibits = entries.map(
  ([id, title, category, description, wall_color, finish], i) => ({
    id,
    title: t(title),
    category,
    description: t(description),
    wall_color,
    finish,
    artist:
      i === 1 ? "Chris Zabriskie" : i === 3 ? "USGS EROS" : t("Estudio Umbral"),
    artist_bio: t(
      i === 1
        ? "Chris Zabriskie escribió, produjo e interpretó Cylinders (2014). Esta sala de escucha fue diseñada por Umbral para presentar su grabación."
        : i === 3
          ? "Earth As Art reúne imágenes satelitales del USGS. Esta selección recorre Argentina y Chile con los sensores Landsat y ASTER."
          : "Arquitectura virtual, imágenes y exposiciones creadas para la colección inaugural de Umbral.",
    ),
    website:
      i === 1
        ? "https://chriszabriskie.com/"
        : i === 3
          ? "https://www.usgs.gov/centers/eros/earth-art"
          : "https://luzbel33.github.io/umbral-gallery/",
    project_url:
      i === 1
        ? "https://chriszabriskie.bandcamp.com/album/cylinders"
        : i === 3
          ? "https://www.usgs.gov/media/images/parana-river-delta"
          : "https://github.com/Luzbel33/umbral-gallery",
    social_url: i === 1 ? "https://www.instagram.com/chriszabriskie/" : null,
    thumb: art("thumb-" + id + ".webp"),
    cover: art((i === 0 ? id : "cover-" + id) + ".webp"),
    hero: art((i === 0 ? "orbital-wide" : "cover-" + id) + ".webp"),
    works: collections[i],
    curated: true,
    music: i === 1 ? recordings.five.url : null,
    recording: i === 1 ? recordings.five : null,
    published: true,
  }),
);
export { disciplines as categories } from "../supabase/functions/_shared/catalog.js";
export const previewPath = (w) => w.room_id + "/" + w.id + ".preview.webp";
export const pathFor = (w) => w.room_id + "/" + w.id + "." + w.extension;
export function adaptRoom(r, objectUrl) {
  const works = (r.works || [])
    .sort((a, b) => a.slot - b.slot)
    .map((w) => ({
      ...w,
      preview: w.has_preview ? objectUrl(previewPath(w)) : null,
      type: workType(w.extension),
      url: objectUrl(pathFor(w)),
    }));
  const ready = works.filter((w) => w.ready);
  const coverWork = ready.find((w) => w.type === "image");
  return {
    ...r,
    works,
    cover: coverWork?.preview || coverWork?.url,
    music: ready.find((w) => w.slot === r.music_slot && w.type === "audio")
      ?.url,
  };
}
import { workType } from "./formats.js";
