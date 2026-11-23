import { readFile, writeFile, mkdir } from "node:fs/promises";
import { exhibits } from "../src/catalog.js";

const html = await readFile("dist/index.html", "utf8");
const site = new URL(
  process.env.SITE_URL || "https://luzbel33.github.io/umbral-gallery/",
);
const base = process.env.BASE_PATH || "/umbral-gallery/";
const safe = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const urls = [site.href];
const home = html.match(/<main id="main" class="shell">([\s\S]*?)<\/main>/)[1];
const links = exhibits
  .map(
    (r) =>
      `<article class="card"><a class="card-cover" href="${base}salas/${r.id}/"><img alt="" loading="lazy" src="${base}art/${r.id}.webp"></a><h3><a href="${base}salas/${r.id}/">${safe(r.title)}</a></h3></article>`,
  )
  .join("");
await writeFile(
  "dist/index.html",
  html.replace(
    /(<div id="cards" class="cards">)\s*<\/div>/,
    "$1" + links + "</div>",
  ),
);
for (const room of exhibits) {
  const url = new URL("salas/" + room.id + "/", site);
  urls.push(url.href);
  const description = safe(room.description);
  const title = safe(room.title + " — Umbral");
  const image = new URL("art/" + room.id + ".webp", site);
  const main = `<section class="detail"><div class="detail-cover"><img src="${base}art/${room.id}.webp" alt="${safe(room.title)}"></div><div class="detail-copy"><p class="kicker">${safe(room.category)}</p><h1>${safe(room.title)}</h1><p>${safe(room.artist)}</p><p>${description}</p><a class="primary" href="${base}?sala=${room.id}&amp;modo=3d">Recorrer en 3D</a></div></section><section class="works"><h2>Obras en sala</h2>${room.works.map((w) => `<p>${safe(w.title)}</p>`).join("")}</section>`;
  const page = html
    .replace(
      /<title>.*?<\/title>/,
      `<title>${title}</title><link rel="canonical" href="${url.href}">`,
    )
    .replace(/(property="og:title"\s+content=")[^"]+/, (_, p) => p + title)
    .replace(
      /((?:property="og:description"|name="description")\s+content=")[^"]+/g,
      (_, p) => p + description,
    )
    .replace(/(property="og:image"\s+content=")[^"]+/, (_, p) => p + image.href)
    .replace(/(property="og:url"\s+content=")[^"]+/, (_, p) => p + url.href)
    .replace(
      /(<link rel="preload" as="image" href=")[^"]+/,
      (_, p) => p + base + "art/" + room.id + ".webp",
    )
    .replace(
      /<main id="main" class="shell">[\s\S]*?<\/main>/,
      () =>
        `<template id="gallery-home">${home}</template><main id="main" class="shell">${main}</main>`,
    );
  const dir = "dist/salas/" + room.id;
  await mkdir(dir, { recursive: true });
  await writeFile(dir + "/index.html", page);
}
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `\n  <url><loc>${safe(url)}</loc></url>`).join("")}\n</urlset>\n`,
);
