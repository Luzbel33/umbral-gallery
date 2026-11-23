import { t } from "./i18n.js";
import { esc } from "./ui.js";
import { safeLink } from "./formats.js";
import { icon } from "./icons.js";

export function credit(recording) {
  if (!recording) return "";
  return `<div class="record-credit">${icon("headphones", 17)}<span><strong>${esc(recording.title)}</strong> · Chris Zabriskie, 2014<br><a href="https://chriszabriskie.com/cylinders/" target="_blank" rel="noopener noreferrer">Cylinders ${icon("external", 12)}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · MP3</span></div>`;
}
export function profile(room) {
  const links = [
    [t("Sitio web"), room.website],
    [t("Red social"), room.social_url],
    [t("Repositorio o demo"), room.project_url],
  ].filter(([, url]) => safeLink(url));
  function link(label, raw) {
    const url = new URL(safeLink(raw)),
      host = url.hostname.replace(/^www\./, "");
    const named = {
      "github.com": "GitHub",
      "instagram.com": "Instagram",
      "youtube.com": "YouTube",
      "x.com": "X",
      "vimeo.com": "Vimeo",
      "soundcloud.com": "SoundCloud",
    };
    const name = host.endsWith(".bandcamp.com")
      ? "Bandcamp"
      : named[host] || label;
    return `<a href="${esc(url.href)}" rel="noopener noreferrer ugc" target="_blank">${esc(name)} ${icon("external", 14)}</a>`;
  }
  return `<section class="artist-profile"><div class="artist-heading">${icon("user", 20)}<div><small>${t("Ficha del artista")}</small><h2>${esc(room.artist)}</h2></div></div>${room.artist_bio ? `<p>${esc(room.artist_bio)}</p>` : ""}<div class="profile-links">${links.map(([label, url]) => link(label, url)).join("")}</div>${credit(room.recording)}</section>`;
}
