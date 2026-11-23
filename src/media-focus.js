// Detached room soundtracks and on-page players share one playback owner.
let active;
function focus(event) {
  const next = event.target;
  if (!(next instanceof HTMLMediaElement)) return;
  if (active && active !== next) active.pause();
  active = next;
  if (next.tagName === "AUDIO" && next.closest(".sound-work"))
    void import("./spectrum.js").then((m) => m.visualize(next)).catch(() => {});
}
export function detachedMedia(el) {
  el.addEventListener("play", focus);
  return el;
}
export function initializeMedia() {
  document.addEventListener("play", focus, true);
}
export function stopMedia() {
  active?.pause();
  active = null;
}
