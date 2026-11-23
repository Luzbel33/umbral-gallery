import { t, language, localizeShell, switchLanguage } from "./i18n.js";
import "@fontsource-variable/space-grotesk";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./style.css";
import "./community.css";
import { exhibits, categories } from "./catalog.js";
import { icon, categoryIcon } from "./icons.js";
import { rooms, publicRoom } from "./public-gallery.js";
import { projectUrl } from "./config.js";
import { profile } from "./profile.js";
import { typeLabels } from "./formats.js";
import { openPiece } from "./viewers.js";
import { patio, showPatio } from "./patio.js";
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

const mountIcons = (root) =>
  root
    .querySelectorAll("[data-icon]")
    .forEach((n) => (n.outerHTML = icon(n.dataset.icon)));
document.documentElement.lang = language;
localizeShell(document);
if ($("#gallery-home")) localizeShell($("#gallery-home").content);
const switcher = $("#language-switch"),
  other = language === "en" ? "es" : "en";
switcher.lang = other;
switcher.textContent = other.toUpperCase();
switcher.setAttribute("aria-label", other === "es" ? "Español" : "English");
switcher.title = other === "es" ? "Español" : "English";
switcher.onclick = switchLanguage;
mountIcons(document);
if ($("#gallery-home")) mountIcons($("#gallery-home").content);
const backend = () => import("./backend.js");
const homeHTML = $("#gallery-home")?.innerHTML || $("#main").innerHTML;
let saved = [];
try {
  saved = JSON.parse(localStorage.getItem("umbral:guardadas") || "[]")
    .filter((x) => typeof x === "string")
    .slice(0, 100);
} catch {}
let slide = 0,
  category = "",
  cursor = null,
  offset = 0,
  version = 0,
  user = null,
  current = null,
  walk = null,
  lastURL = location.href;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const params = () => {
  const url = new URL(location.href);
  const id = url.pathname.match(/\/salas\/([a-z]+)\/?$/)?.[1];
  if (id && !url.searchParams.has("sala")) url.searchParams.set("sala", id);
  return url.searchParams;
};
const href = (id, walking = false) =>
  !walking && exhibits.some((r) => r.id === id)
    ? import.meta.env.BASE_URL + "salas/" + id + "/"
    : import.meta.env.BASE_URL +
      "?sala=" +
      encodeURIComponent(id) +
      (walking ? "&modo=3d" : "");
function navigate(url) {
  history.pushState({}, "", url);
  void route();
}
let favoriteOwner = null,
  favoriteRequest = Promise.resolve(true);
const favoriteBusy = new Set();
function loadFavorites(account) {
  const id = account?.id || null;
  if (id === favoriteOwner) return;
  favoriteOwner = id;
  if (!id) {
    try {
      saved = JSON.parse(localStorage.getItem("umbral:guardadas") || "[]");
    } catch {
      saved = [];
    }
    paintSaved();
    return;
  }
  saved = [];
  paintSaved();
  favoriteRequest = new Promise((resolve) => setTimeout(resolve, 0)).then(
    async () => {
      try {
        const { client } = await backend();
        const { data, error } = await client
          .from("gallery_favorites")
          .select("room_key")
          .eq("user_id", id);
        if (error) throw error;
        if (id === favoriteOwner) {
          saved = data.map((r) => r.room_key);
          paintSaved();
        }
        return true;
      } catch {
        if (id === favoriteOwner)
          toast(t("No se pudieron cargar tus favoritos."));
        return false;
      }
    },
  );
}
async function storeSaved(id) {
  if (favoriteBusy.has(id)) return;
  if (user) {
    const owner = user.id;
    favoriteBusy.add(id);
    try {
      if (!(await favoriteRequest)) {
        favoriteOwner = null;
        loadFavorites(user);
        if (!(await favoriteRequest))
          throw Error(t("Reintentá cuando se restablezca la conexión."));
      }
      if (user?.id !== owner) return;
      const active = !saved.includes(id),
        { client } = await backend();
      const { error } = await client.rpc("set_gallery_favorite", {
        room_key: id,
        saved: active,
      });
      if (error) throw error;
      if (user?.id !== owner) return;
      saved = active
        ? [...new Set([...saved, id])]
        : saved.filter((x) => x !== id);
      paintSaved();
    } catch (e) {
      toast(failure(e));
    } finally {
      favoriteBusy.delete(id);
    }
    return;
  }
  if (saved.includes(id)) saved = saved.filter((x) => x !== id);
  else {
    if (saved.length >= 100) {
      toast(t("Podés guardar hasta 100 salas en este dispositivo."));
      return;
    }
    saved.push(id);
  }
  try {
    localStorage.setItem("umbral:guardadas", JSON.stringify(saved));
  } catch {
    toast(t("El navegador no pudo guardar la selección."));
  }
  paintSaved();
}
function paintSaved() {
  document.querySelectorAll("[data-save]").forEach((b) => {
    const active = saved.includes(b.dataset.save);
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", active);
    b.setAttribute(
      "aria-label",
      active ? t("Quitar de guardadas") : t("Guardar sala"),
    );
  });
  if (params().get("vista") === "guardadas") void catalog();
}
function bookmark(r) {
  const active = saved.includes(r.id);
  return `<button data-save="${esc(r.id)}" aria-label="${active ? t("Quitar de guardadas") : t("Guardar sala")}" aria-pressed="${active}" class="round bookmark ${active ? "selected" : ""}">${icon("bookmark", 17)}</button>`;
}
function card(r) {
  return `<article class="card"><a data-nav href="${href(r.id)}" class="card-cover" aria-label="${t("Abrir")} ${esc(r.title)}">${r.cover ? `<img src="${esc(r.thumb || r.cover)}" alt="" loading="lazy" decoding="async">` : fallback(r)}<span class="tag">${icon(categoryIcon[r.category], 14)}${esc(t(r.category))}</span></a>${bookmark(r)}<div class="card-caption"><div><h3><a data-nav href="${href(r.id)}">${esc(r.title)}</a></h3><p>${esc(r.artist)}</p></div><a aria-label="${t("Entrar a")} ${esc(r.title)}" class="card-arrow" data-nav href="${href(r.id)}">${icon("external", 21)}</a></div></article>`;
}
const featured = [exhibits[3], exhibits[1], exhibits[0], exhibits[2]];
function setSlide(n) {
  slide = (n + featured.length) % featured.length;
  const r = featured[slide];
  const img = $("#hero-image");
  if (r.id === "estratos") {
    const small = r.works[0].preview;
    img.sizes = "(max-width:650px) 95vw, 60vw";
    img.srcset =
      small + " 420w, " + small.replace("-preview", "-hero") + " 960w";
    img.src = small;
  } else {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = r.hero;
  }
  img.alt =
    r.id === "estratos"
      ? r.works[0].title + " · USGS EROS"
      : `${t("Vista de la exposición")} ` + r.title;
  const [first, ...rest] = r.title.split(" ");
  $("#hero-title").innerHTML =
    esc(first) + (rest.length ? " <em>" + esc(rest.join(" ")) + "</em>" : "");
  $("#hero-desc").textContent = r.description;
  $("#hero-enter").href = href(r.id, true);
  $("#hero-detail").href = href(r.id);
  $("#hero-credit").textContent = r.artist;
  $("#slide-no").innerHTML =
    String(slide + 1).padStart(2, "0") + " <em>/ 04</em>";
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
    cursor = null;
    cards.innerHTML = exhibits.filter(filter).map(card).join("");
    $("#filters").innerHTML = ["", ...categories]
      .map(
        (c) =>
          `<button class="chip ${c === category ? "active" : ""}" aria-pressed="${category === c}" data-category="${c}">${c ? icon(categoryIcon[c], 16) : icon("grid", 15)} ${t(c || "Todas")}</button>`,
      )
      .join("");
  }
  status.textContent = "";
  next.hidden = true;
  const ids = saved.filter((x) => uuid.test(x));
  try {
    const rows = savedView
      ? ids.length
        ? await (await backend()).favoriteRooms({ category, ids, offset })
        : []
      : await rooms({ category, cursor });
    if (ticket !== version) return;
    cards.insertAdjacentHTML("beforeend", rows.slice(0, 12).map(card).join(""));
    cursor = rows[11] || null;
    offset += 12;
    next.hidden = rows.length <= 12;
    if (!cards.children.length)
      status.textContent = savedView
        ? t(
            "Todavía no guardaste salas de esta selección. Usá el marcador sobre una portada.",
          )
        : t("Todavía no hay salas de esta disciplina.");
  } catch {
    if (ticket === version) {
      status.innerHTML = `${t("No se pudieron cargar las salas de artistas.")} <button class="text-btn" data-retry>${t("Reintentar")}</button>`;
    }
  }
}
function detail(r) {
  const works = r.works.filter((w) => w.ready !== false);
  $("#main").innerHTML =
    `<a data-nav href="./" class="crumb">${icon("back", 16)} ${t("Explorar salas")}</a><section class="detail"><div class="detail-cover">${r.cover ? `<img src="${esc(r.cover)}" alt="${esc(r.title)}">` : fallback(r)}</div><div class="detail-copy"><p class="kicker"><i></i> ${esc(t(r.category).toUpperCase())}</p><h1>${esc(r.title)}</h1><button type="button" class="by artist-jump">${icon("user", 15)} ${esc(r.artist)} ${icon("down", 13)}</button><p>${esc(r.description)}</p><div class="row"><a data-nav href="${href(r.id, true)}" class="primary">${icon("box")} ${t("Recorrer en 3D")}</a>${bookmark(r)}<button class="round" data-share aria-label="${t("Copiar enlace a la sala")}">${icon("copy")}</button></div></div></section><section class="works"><h2>${t("Obras en sala")}</h2><div class="pieces">${works.map((w, i) => `<article><div class="piece">${w.type === "image" ? `<button class="image-open" aria-label="${t("Ampliar")} ${esc(w.title)}" data-piece="${i}">${media(w, true)}</button>` : media(w)}</div><h3>${esc(w.title)}</h3></article>`).join("") || `<p>${t("El artista todavía está preparando sus obras.")}</p>`}</div></section>`;
  $(".detail").insertAdjacentHTML("afterend", profile(r));
  $(".artist-jump").onclick = () => panel(t("Ficha del artista"), profile(r));
  const pieces = $(".pieces");
  Array.from(pieces.children).forEach((article, i) => {
    const w = works[i];
    if (w && !["image", "audio", "video"].includes(w.type)) {
      $(".piece", article).innerHTML =
        `<button class="file-tile" data-piece="${i}">${icon(w.type === "model" ? "box" : w.type === "source" ? "layers" : "grid", 32)}<span>${t("Abrir")} ${esc(typeLabels[w.type])}</span><small>${esc(w.source_name)}</small></button>`;
    }
  });
}
async function resolveRoom(id) {
  if (user?.id === id) return (await backend()).readRoom(id);
  if (hasSession()) {
    const { client, readRoom } = await backend();
    if ((await client.auth.getSession()).data.session?.user.id === id)
      return readRoom(id);
  }
  return publicRoom(id);
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
  $("#explore-link").classList.toggle("current", !savedView && id !== "patio");
  $("#patio-link").classList.toggle("current", id === "patio");
  $("#saved-link").classList.toggle("current", savedView);
  document.title = t("Umbral — Galería de arte virtual");
  document.querySelector('meta[name="description"]').content = t(
    "Explorá arte, música, modelos 3D y proyectos de programación. Visitá el patio o creá una sala gratuita en Umbral desde tu navegador.",
  );
  if (!id) {
    $("#main").innerHTML = homeHTML;
    if (prior.searchParams.get("vista") !== p.get("vista")) category = "";
    if (savedView) {
      $(".hero").remove();
      $("#catalog-title").textContent = t("Salas guardadas");
    } else setSlide(slide);
    $("#more").onclick = () => catalog(true);
    void catalog();
  } else {
    $("#main").innerHTML = `<p class="loading">${t("Abriendo sala…")}</p>`;
    try {
      const r =
        (id === "patio" ? patio : null) ||
        exhibits.find((r) => r.id === id) ||
        (uuid.test(id) ? await resolveRoom(id) : null);
      if (ticket !== version) return;
      if (!r)
        throw Error(
          t("Esta sala todavía no está publicada o el enlace cambió."),
        );
      current = r;
      document.title = r.title + " — Umbral";
      if (r.description)
        document.querySelector('meta[name="description"]').content =
          r.description;
      if (p.get("modo") === "3d") {
        const { enterWalk } = await import("./walk.js");
        if (ticket !== version) return;
        walk = enterWalk(r, {
          exit: () => navigate(href(id)),
          openPiece,
          login: () => auth("login"),
        });
      } else if (id === "patio")
        walk = await showPatio(
          () => navigate(href("patio", true)),
          () => auth("login"),
          () => user,
          () => ticket === version,
        );
      else detail(r);
    } catch (e) {
      if (ticket === version)
        $("#main").innerHTML =
          `<div class="empty"><h1>${t("No se pudo abrir la sala")}</h1><p>${esc(failure(e))}</p><a data-nav class="secondary" href="${p.get("modo") === "3d" ? href(id) : "./"}">${p.get("modo") === "3d" ? t("Ver en modo web") : t("Explorar salas")}</a></div>`;
    }
  }
  window.scrollTo(0, 0);
}
function accountUI() {
  $("#signin").textContent = user ? t("Salir") : t("Ingresar");
  $("#studio-label").textContent = user ? t("Mi espacio") : t("Registrarme");
  loadFavorites(user);
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
    panel(t("Mi sala"), `<p>${esc(failure(e))}</p>`);
  }
}
function auth(mode, after) {
  const reg = mode === "register";
  panel(
    reg ? t("Creá tu cuenta") : t("Ingresá a Umbral"),
    `<form id="auth-form"><p>${reg ? t("Guardá favoritos y conversá en el patio con una llave de acceso. Podés crear una sala cuando quieras. Elegí una llave sincronizada para usarla en otros dispositivos.") : t("Usá la llave de acceso que guardaste al registrarte.")}</p>${reg ? `<label>${t("Nombre público")}<input name="label" required maxlength="48" autocomplete="nickname" placeholder="${t("Tu nombre o seudónimo")}"></label>` : ""}<p role="status" class="form-status"></p><button class="primary" type="submit">${icon("user")} ${reg ? t("Registrar llave de acceso") : t("Ingresar con mi llave")}</button></form><button class="text-btn switch">${reg ? t("Ya tengo una cuenta") : t("Crear una cuenta")}</button>`,
  );
  $(".switch").onclick = () => auth(reg ? "login" : "register", after);
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    const status = $(".form-status", form);
    status.textContent = t("Esperando tu llave de acceso…");
    try {
      const pass = await import("./passkeys.js");
      user = await pass.authenticate(mode, new FormData(form).get("label"));
      accountUI();
      restoreAuth();
      if (dialog.open) dialog.close();
      toast(
        reg
          ? t(
              "Tu cuenta está lista. Podés guardar salas o abrir tu propio espacio.",
            )
          : t("Ya ingresaste a Umbral."),
      );
      await route();
      if (after) await after();
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
  const signOutButton = $("#signin");
  signOutButton.disabled = true;
  try {
    const { client } = await backend();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    user = null;
    accountUI();
    await route();
    toast(t("Cerraste sesión."));
  } catch (e) {
    toast(failure(e));
  } finally {
    signOutButton.disabled = false;
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
  if (n.hasAttribute("data-exhibit")) {
    if (user) void showStudio();
    else auth("register", showStudio);
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
      toast(t("Enlace copiado."));
    } catch {
      panel(
        t("Enlace a la sala"),
        `<input readonly value="${esc(location.href)}">`,
      );
    }
  } else if (n.hasAttribute("data-piece") && current) {
    const w = current.works.filter((w) => w.ready !== false)[
      Number(n.dataset.piece)
    ];
    void openPiece(w);
  }
});
window.addEventListener("popstate", route);
const authKey =
  "sb-" + new URL(projectUrl).hostname.split(".")[0] + "-auth-token";
function hasSession() {
  try {
    return !!localStorage.getItem(authKey);
  } catch {
    return true;
  }
}
let restoring;
function restoreAuth() {
  restoring ??= backend()
    .then(({ client }) =>
      client.auth.onAuthStateChange((_event, session) => {
        user = session?.user || null;
        accountUI();
      }),
    )
    .catch(() => {
      restoring = null;
    });
}
if (hasSession()) restoreAuth();
window.addEventListener("storage", (e) => {
  if (e.key === authKey) restoreAuth();
});
void route();
