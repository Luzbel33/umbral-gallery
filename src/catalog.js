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
    {
      ...work("Delta del Paraná", "image", "earth-parana_delta_0.webp"),
      medium: "USGS · Landsat",
      caption: t(
        "Los canales del delta del Paraná dibujan una red entre las islas y el estuario.",
      ),
    },
    {
      ...work("Sabotage", "image", "earth-sabotage.webp"),
      medium: "USGS · Earth As Art",
      caption: t(
        "En esta imagen del río Colorado, el falso color hace visibles las diferencias entre cauces y terrenos secos.",
      ),
    },
    {
      ...work("Andes", "image", "earth-andes_0.webp"),
      medium: "USGS · Earth As Art",
      caption: t(
        "La imagen satelital recorta los pliegues minerales y los valles de la cordillera.",
      ),
    },
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
export const workshop = {
  id: "taller",
  demo: true,
  published: true,
  title: t("Gabinete de pliegues"),
  artist: t("Estudio Umbral"),
  description: t(
    "Una sala de ejemplo que podés editar. Reunimos un estudio en imagen, una escultura de cobre y una pieza para escuchar.",
  ),
  artist_bio: t(
    "El equipo de Umbral diseñó esta muestra para que puedas probar cómo se monta una exposición.",
  ),
  category: "Multidisciplinaria",
  wall_color: "#c1b8a7",
  finish: "Basalto",
  room_size: "standard",
  label_style: "wall",
  website: "https://luzbel33.github.io/umbral-gallery/",
  social_url: "https://github.com/Luzbel33",
  project_url: "https://github.com/Luzbel33/umbral-gallery",
  thumb: art("thumb-taller.webp"),
  cover: art("cover-taller.webp"),
  music_slot: 3,
  music: recordings.six.url,
  recording: recordings.six,
  works: [
    {
      id: "study",
      bytes: 63778,
      slot: 1,
      title: t("Estudio de torsión"),
      type: "image",
      url: art("orbital-wide.webp"),
      preview: art("thumb-orbital.webp"),
      medium: t("Estudio digital"),
      caption: t(
        "La luz rasante revela el cambio de espesor entre dos pliegues.",
      ),
      year: 2026,
    },
    {
      id: "fold",
      bytes: 56636,
      slot: 2,
      title: t("Abanico de cobre"),
      type: "model",
      url: art("copper-fan.mesh"),
      source_name: "copper-fan.mesh",
      medium: t("Escultura digital"),
      year: 2026,
      orientation: 25,
      caption: t(
        "Recorré la pieza desde un lado para ver cómo cada lámina proyecta sombra sobre la siguiente.",
      ),
    },
    {
      id: "track",
      bytes: 831227,
      slot: 3,
      title: "Cylinder Six",
      type: "audio",
      url: recordings.six.url,
      medium: "Chris Zabriskie · Cylinders",
      year: 2014,
      caption: t(
        "Grabación de Chris Zabriskie, publicada bajo CC BY 4.0. También suena como música ambiente si la activás.",
      ),
    },
  ].map((w) => ({ ...w, ready: true })),
};
exhibits.push(workshop);
export { disciplines as categories } from "../supabase/functions/_shared/catalog.js";
export const previewPath = (w) => w.room_id + "/" + w.id + ".preview.webp";
export const pathFor = (w) => w.room_id + "/" + w.id + "." + w.extension;
export function adaptRoom(r, objectUrl) {
  const works = (r.works || [])
    .sort((a, b) => a.slot - b.slot)
    .map((w) => ({
      ...w,
      preview:
        w.preview_url || (w.has_preview ? objectUrl(previewPath(w)) : null),
      type: workType(w.extension),
      url: w.external_url || w.cloud_url || objectUrl(pathFor(w)),
    }));
  const ready = works.filter((w) => w.ready);
  const coverWork = ready.find((w) => w.type === "image");
  return {
    ...r,
    works,
    cover: coverWork?.preview || coverWork?.url,
    music: ready.find(
      (w) => w.slot === r.music_slot && w.type === "audio" && !w.external_url,
    )?.url,
  };
}
import { workType } from "./formats.js";
