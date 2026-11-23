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
    "Una sala de escucha donde cada curva sigue la resonancia de un acorde.",
    "#465795",
    "Basalto",
  ],
  [
    "intervalos",
    "Intervalos",
    "Video",
    "Un recorrido en movimiento por una sucesión de portales de óxido.",
    "#ad543a",
    "Basalto",
  ],
  [
    "estratos",
    "Estratos de luz",
    "Fotografía",
    "Un ensayo fotográfico virtual sobre el ritmo de la piedra y el paso de la luz.",
    "#c8ab88",
    "Madera",
  ],
];
const work = (title, type, file) => ({ title, type, url: art(file) });
const collections = [
  [
    work("Materia orbital · Vista frontal", "image", "orbital.webp"),
    work("El espacio entre los pliegues", "image", "orbital-wide.webp"),
  ],
  [
    work("Onda continua", "audio", "onda.mp3"),
    work("Frecuencia azul · Estudio de forma", "image", "frecuencia.webp"),
  ],
  [
    work("Tránsito", "video", "transito.mp4"),
    work("Intervalos · Fotograma", "image", "intervalos.webp"),
  ],
  [work("Estratos de luz", "image", "estratos.webp")],
];
export const exhibits = entries.map(
  ([id, title, category, description, wall_color, finish], i) => ({
    id,
    title,
    category,
    description,
    wall_color,
    finish,
    artist: "Estudio Umbral",
    cover: art(id + ".webp"),
    hero: art((i === 0 ? "orbital-wide" : id) + ".webp"),
    works: collections[i],
    curated: true,
    music: i === 1 ? art("onda.mp3") : null,
    published: true,
  }),
);
export const categories = [
  "Escultura",
  "Fotografía",
  "Música",
  "Video",
  "Pintura",
  "Digital",
  "Programación",
  "Diseño",
  "Literatura",
  "Multidisciplinaria",
];
export const pathFor = (w) => w.room_id + "/" + w.id + "." + w.extension;
export function adaptRoom(r, storage) {
  const works = (r.works || [])
    .sort((a, b) => a.slot - b.slot)
    .map((w) => ({
      ...w,
      type: workType(w.extension),
      url: storage.getPublicUrl(pathFor(w)).data.publicUrl,
    }));
  const ready = works.filter((w) => w.ready);
  return {
    ...r,
    works,
    cover: ready.find((w) => w.type === "image")?.url,
    music: ready.find((w) => w.slot === r.music_slot && w.type === "audio")
      ?.url,
  };
}
import { workType } from "./formats.js";
