import "@fontsource-variable/space-grotesk";
import "@fontsource/barlow-condensed/latin-600.css";
import "./style.css";
import { exhibits, categories } from "./catalog.js";
import { icon, categoryIcon } from "./icons.js";
import {
  $,
  dialog,
  panel,
  esc,
  toast,
  failure,
  fallback,
  media,
  pauseMedia,
} from "./ui.js";

document
  .querySelectorAll("[data-icon]")
  .forEach((n) => (n.outerHTML = icon(n.dataset.icon)));
const backend = () => import("./backend.js");
const homeHTML = $("#main").innerHTML;
let saved = [];
try {
  saved = JSON.parse(localStorage.getItem("umbral:guardadas") || "[]")
    .filter((x) => typeof x === "string")
    .slice(0, 100);
} catch {}
let slide = 0,
  category = "",
  offset = 0,
  version = 0,
  user = null,
  current = null,
  walk = null,
  lastURL = location.href;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const params = () => new URL(location.href).searchParams;
const href = (id, walking = false) =>
  "?sala=" + encodeURIComponent(id) + (walking ? "&modo=3d" : "");
function navigate(url) {
  history.pushState({}, "", url);
  void route();
}
function storeSaved(id) {
  if (saved.includes(id)) saved = saved.filter((x) => x !== id);
  else {
    if (saved.length >= 100) {
      toast("Podés guardar hasta 100 salas en este dispositivo.");
      return;
    }
    saved.push(id);
  }
  try {
    localStorage.setItem("umbral:guardadas", JSON.stringify(saved));
  } catch {
    toast("El navegador no pudo guardar la selección.");
  }
  document.querySelectorAll("[data-save]").forEach((b) => {
    const active = saved.includes(b.dataset.save);
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", active);
    b.setAttribute(
      "aria-label",
      active ? "Quitar de guardadas" : "Guardar sala",
    );
  });
  if (params().get("vista") === "guardadas") void catalog();
}
function bookmark(r) {
  const active = saved.includes(r.id);
  return `<button data-save="${esc(r.id)}" aria-label="${active ? "Quitar de guardadas" : "Guardar sala"}" aria-pressed="${active}" class="round bookmark ${active ? "selected" : ""}">${icon("bookmark", 17)}</button>`;
}
function card(r) {
  return `<article class="card"><a data-nav href="${href(r.id)}" class="card-cover" aria-label="Abrir ${esc(r.title)}">${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy" decoding="async">` : fallback(r)}<span class="tag">${icon(categoryIcon[r.category], 14)}${esc(r.category)}</span></a>${bookmark(r)}<div class="card-caption"><div><h3><a data-nav href="${href(r.id)}">${esc(r.title)}</a></h3><p>${esc(r.artist)}</p></div><a aria-label="Entrar a ${esc(r.title)}" class="card-arrow" data-nav href="${href(r.id)}">${icon("external", 21)}</a></div></article>`;
}
function setSlide(n) {
  slide = (n + 3) % 3;
  const r = exhibits[slide];
  const img = $("#hero-image");
  img.src = r.hero;
  img.alt = "Vista de la exposición " + r.title;
  const [first, ...rest] = r.title.split(" ");
  $("#hero-title").innerHTML =
    esc(first) +
    (rest.length ? "<br>" + esc(rest.join(" ")) : "") +
    "<span>.</span>";
  $("#hero-desc").textContent = r.description;
  $("#hero-enter").href = href(r.id, true);
  $("#slide-no").innerHTML =
    String(slide + 1).padStart(2, "0") + " <em>/ 03</em>";
}
async function catalog(more = false) {
  const ticket = ++version;
  const savedView = params().get("vista") === "guardadas";
  const filter = (r) =>
    (!category || r.category === category) &&
    (!savedView || saved.includes(r.id));
  const cards = $("#cards"),
    status = $("#catalog-status"),
    next = $("#more");
  if (!cards) return;
  if (!more) {
    offset = 0;
    cards.innerHTML = exhibits.filter(filter).map(card).join("");
    $("#filters").innerHTML = ["", ...categories]
      .map(
        (c) =>
          `<button class="chip ${c === category ? "active" : ""}" aria-pressed="${category === c}" data-category="${c}">${c ? icon(categoryIcon[c], 16) : icon("grid", 15)} ${c || "Todas"}</button>`,
      )
      .join("");
  }
  status.textContent = "";
  next.hidden = true;
  const ids = saved.filter((x) => uuid.test(x));
  try {
    const rows =
      savedView && !ids.length
        ? []
        : await (
            await backend()
          ).rooms({
            category,
            ids: savedView ? ids : undefined,
            offset,
            limit: 13,
          });
    if (ticket !== version) return;
    cards.insertAdjacentHTML("beforeend", rows.slice(0, 12).map(card).join(""));
    offset += 12;
    next.hidden = rows.length <= 12;
    if (!cards.children.length)
      status.textContent = savedView
        ? "Todavía no guardaste salas de esta selección. Usá el marcador sobre una portada."
        : "Todavía no hay salas de esta disciplina.";
  } catch {
    if (ticket === version) {
      status.innerHTML =
        'No se pudieron cargar las salas de artistas. <button class="text-btn" data-retry>Reintentar</button>';
    }
  }
}
function detail(r) {
  const works = r.works.filter((w) => w.ready !== false);
  $("#main").innerHTML =
    `<a data-nav href="./" class="crumb">${icon("back", 16)} Explorar salas</a><section class="detail"><div class="detail-cover">${r.cover ? `<img src="${esc(r.cover)}" alt="${esc(r.title)}">` : fallback(r)}</div><div class="detail-copy"><p class="kicker"><i></i> ${esc(r.category.toUpperCase())}</p><h1>${esc(r.title)}</h1><p class="by">${esc(r.artist)}</p><p>${esc(r.description)}</p><div class="row"><a data-nav href="${href(r.id, true)}" class="primary">${icon("box")} Recorrer en 3D</a>${bookmark(r)}<button class="round" data-share aria-label="Copiar enlace a la sala">${icon("copy")}</button></div></div></section><section class="works"><h2>Obras en sala</h2><div class="pieces">${works.map((w, i) => `<article><div class="piece">${w.type === "image" ? `<button class="image-open" aria-label="Ampliar ${esc(w.title)}" data-piece="${i}">${media(w)}</button>` : media(w)}</div><h3>${esc(w.title)}</h3></article>`).join("") || "<p>El artista todavía está preparando sus obras.</p>"}</div></section>`;
}
async function route() {
  const ticket = ++version;
  const prior = new URL(lastURL);
  lastURL = location.href;
  walk?.();
  walk = null;
  current = null;
  if (dialog.open) dialog.close();
  document.body.classList.remove("walking");
  const p = params(),
    id = p.get("sala"),
    savedView = p.get("vista") === "guardadas";
  $("#explore-link").classList.toggle("current", !savedView);
  $("#saved-link").classList.toggle("current", savedView);
  document.title = "Umbral — Galería de arte virtual";
  if (!id) {
    $("#main").innerHTML = homeHTML;
    if (prior.searchParams.get("vista") !== p.get("vista")) category = "";
    if (savedView) {
      $(".hero").remove();
      $("#catalog-title").textContent = "Salas guardadas";
    } else setSlide(slide);
    $("#more").onclick = () => catalog(true);
    void catalog();
  } else {
    $("#main").innerHTML = '<p class="loading">Abriendo sala…</p>';
    try {
      const r =
        exhibits.find((r) => r.id === id) ||
        (uuid.test(id) ? await (await backend()).readRoom(id) : null);
      if (ticket !== version) return;
      if (!r)
        throw Error("Esta sala todavía no está publicada o el enlace cambió.");
      current = r;
      document.title = r.title + " — Umbral";
      if (p.get("modo") === "3d") {
        const { enterWalk } = await import("./walk.js");
        if (ticket !== version) return;
        walk = enterWalk(r, {
          exit: () => navigate(href(id)),
          openPiece: (w) => panel(w.title, media(w), "viewer"),
        });
      } else detail(r);
    } catch (e) {
      if (ticket === version)
        $("#main").innerHTML =
          `<div class="empty"><h1>No se pudo abrir la sala</h1><p>${esc(failure(e))}</p><a data-nav class="secondary" href="${p.get("modo") === "3d" ? href(id) : "./"}">${p.get("modo") === "3d" ? "Ver en modo web" : "Explorar salas"}</a></div>`;
    }
  }
  window.scrollTo(0, 0);
}
function accountUI() {
  $("#signin").textContent = user ? "Salir" : "Ingresar";
  $("#studio-label").textContent = user ? "Mi sala" : "Crear sala";
}
async function showStudio() {
  try {
    const editor = await import("./studio.js");
    await editor.openStudio(
      user,
      () => {
        void route();
      },
      navigate,
    );
  } catch (e) {
    panel("Mi sala", `<p>${esc(failure(e))}</p>`);
  }
}
function auth(mode) {
  const reg = mode === "register";
  panel(
    reg ? "Creá tu sala" : "Ingresá a Umbral",
    `<form id="auth-form"><p>${reg ? "Registrate con una llave de acceso para publicar tus obras. Elegí una llave sincronizada para entrar también desde otro dispositivo." : "Usá la llave de acceso que guardaste al crear tu sala."}</p>${reg ? '<label>Nombre de artista<input name="label" required maxlength="48" autocomplete="nickname" placeholder="Tu nombre o seudónimo"></label>' : ""}<p role="status" class="form-status"></p><button class="primary" type="submit">${icon("user")} ${reg ? "Registrar llave de acceso" : "Ingresar con mi llave"}</button></form><button class="text-btn switch">${reg ? "Ya tengo una cuenta" : "Crear una cuenta"}</button>`,
  );
  $(".switch").onclick = () => auth(reg ? "login" : "register");
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    const status = $(".form-status", form);
    status.textContent = "Esperando tu llave de acceso…";
    try {
      const pass = await import("./passkeys.js");
      user = await pass.authenticate(mode, new FormData(form).get("label"));
      accountUI();
      if (dialog.open) dialog.close();
      await showStudio();
    } catch (err) {
      status.textContent = failure(err);
    } finally {
      btn.disabled = false;
    }
  };
}
$("#signin").onclick = async () => {
  if (!user) {
    auth("login");
    return;
  }
  try {
    const { client } = await backend();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    user = null;
    accountUI();
    void route();
    toast("Cerraste sesión.");
  } catch (e) {
    toast(failure(e));
  }
};
$("#studio").onclick = () => (user ? showStudio() : auth("register"));
dialog.addEventListener("close", pauseMedia);
document.addEventListener("click", async (e) => {
  const n = e.target.closest("a,button");
  if (!n) {
    if (e.target === dialog) dialog.close();
    return;
  }
  if (
    n.matches("[data-nav],.brand,#explore-link,#saved-link,#hero-enter") &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    !e.altKey
  ) {
    e.preventDefault();
    navigate(n.href);
    return;
  }
  if (n.hasAttribute("data-close")) dialog.close();
  else if (n.hasAttribute("data-slide"))
    setSlide(slide + Number(n.dataset.slide));
  else if (n.hasAttribute("data-save")) storeSaved(n.dataset.save);
  else if (n.hasAttribute("data-category")) {
    category = n.dataset.category;
    void catalog();
  } else if (n.id === "filters-toggle") {
    const f = $("#filters");
    f.classList.toggle("expanded");
    n.setAttribute("aria-expanded", f.classList.contains("expanded"));
  } else if (n.hasAttribute("data-retry")) void catalog();
  else if (n.hasAttribute("data-share")) {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Enlace copiado.");
    } catch {
      panel(
        "Enlace a la sala",
        `<input readonly value="${esc(location.href)}">`,
      );
    }
  } else if (n.hasAttribute("data-piece") && current) {
    const w = current.works.filter((w) => w.ready !== false)[
      Number(n.dataset.piece)
    ];
    panel(w.title, media(w), "viewer");
  }
});
window.addEventListener("popstate", route);
void route();
backend()
  .then(({ client }) =>
    client.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      accountUI();
    }),
  )
  .catch(() => {});
