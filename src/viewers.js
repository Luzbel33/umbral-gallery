import {t} from "./i18n.js";
import { $, esc, dialog, panel, media, failure } from "./ui.js";
import { readBounded, suffix, typeLabels } from "./formats.js";
import { icon } from "./icons.js";
function tableRows(text, sep) {
  const rows = [];
  let row = [],
    cell = "",
    quote = false;
  for (let i = 0; i < text.length && rows.length < 100; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quote = !quote;
    } else if (!quote && (c === sep || c === "\n")) {
      if (row.length < 30) row.push(cell.trimEnd());
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else if (cell.length < 1500) cell += c;
  }
  if (row.length || cell) rows.push([...row, cell]);
  return rows;
}
function showText(el, bytes, file) {
  let text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\0")) throw Error(t("El visor necesita texto UTF-8."));
  const ext = suffix(file);
  if (ext === "csv" || ext === "tsv") {
    const rows = tableRows(text, ext === "csv" ? "," : "\t");
    el.innerHTML = `<div class="table-scroll"><table>${rows.map((r, i) => "<tr>" + r.map((s) => (i ? "<td>" + esc(s) + "</td>" : "<th>" + esc(s) + "</th>")).join("") + "</tr>").join("")}</table></div><small>${t("Vista de hasta 100 filas y 30 columnas.")}</small>`;
    return;
  }
  if (ext === "json" || ext === "ipynb") {
    try {
      const json = JSON.parse(text);
      text =
        ext === "ipynb" && Array.isArray(json.cells)
          ? json.cells
              .slice(0, 150)
              .map(
                (c) =>
                  (c.cell_type === "code" ? t("Código") : t("Texto")) +
                  "\n" +
                  (Array.isArray(c.source)
                    ? c.source.join("")
                    : String(c.source ?? "")),
              )
              .join("\n\n")
          : JSON.stringify(json, null, 2);
    } catch {}
  }
  el.innerHTML = "<pre tabindex='0'></pre>";
  $("pre", el).textContent =
    text.slice(0, 180000) + (text.length > 180000 ? "\n… "+t("Vista abreviada") : "");
}
let cancel = null;
export async function openPiece(w) {
  cancel?.();
  panel(
    w.title,
    `<div class="file-view" id="file-view"><p role="status">${t("Abriendo")} ${esc(typeLabels[w.type] || t("obra"))}…</p></div>`,
    "viewer",
  );
  const el = $("#file-view"),
    controller = new AbortController();
  let cleanup = () => {};
  const end = () => {
    controller.abort();
    cleanup();
    dialog.removeEventListener("close", end);
    if (cancel === end) cancel = null;
  };
  cancel = end;
  dialog.addEventListener("close", end, { once: true });
  try {
    if (["image", "audio", "video"].includes(w.type)) {
      el.innerHTML = media(w);
      return;
    }
    const bytes = await readBounded(
      w.url,
      w.type === "source" ? 524288 : 12 * 1024 ** 2,
      controller.signal,
    );
    if (!el.isConnected || controller.signal.aborted) return;
    if (w.type === "source") showText(el, bytes, w.source_name);
    else if (w.type === "model") {
      const { showModel } = await import("./model-view.js");
      if (el.isConnected && !controller.signal.aborted)
        cleanup = showModel(el, bytes);
    } else if (w.type === "document") {
      const pdf = await import("pdfjs-dist/build/pdf.mjs"),
        worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
          .default;
      if (!el.isConnected || controller.signal.aborted) return;
      pdf.GlobalWorkerOptions.workerSrc = worker;
      const task = pdf.getDocument({
        data: bytes,
        isEvalSupported: false,
        enableXfa: false,
        useSystemFonts: false,
        useWorkerFetch: false,
        maxImageSize: 12000000,
        canvasMaxAreaInBytes: 16000000,
        disableFontFace: true,
        disableAutoFetch: true,
      });
      cleanup = () => {
        void task.destroy();
      };
      const doc = await task.promise;
      if (controller.signal.aborted) return;
      el.innerHTML = `<div class="pdf-bar"><button class="secondary" data-prev aria-label="${t("Página anterior")}">${icon("left")}</button><span role="status"></span><button class="secondary" data-next aria-label="${t("Página siguiente")}">${icon("right")}</button></div><canvas aria-label="${t("Página del PDF")}"></canvas>`;
      let num = 1;
      const prev = $("[data-prev]", el),
        next = $("[data-next]", el);
      async function draw() {
        prev.disabled = next.disabled = true;
        try {
          const page = await doc.getPage(num);
          if (controller.signal.aborted) return;
          const v = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(2, 1200 / v.width, 1600 / v.height),
          });
          const c = $("canvas", el);
          c.width = Math.ceil(viewport.width);
          c.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: c.getContext("2d"), viewport })
            .promise;
          $("[role=status]", el).textContent = num + " / " + doc.numPages;
          page.cleanup();
        } catch (e) {
          if (!controller.signal.aborted)
            $("[role=status]", el).textContent = failure(e);
        } finally {
          prev.disabled = num === 1;
          next.disabled = num >= doc.numPages;
        }
      }
      prev.onclick = () => {
        num--;
        void draw();
      };
      next.onclick = () => {
        num++;
        void draw();
      };
      await draw();
    }
  } catch (e) {
    if (!controller.signal.aborted) el.textContent = failure(e);
  }
}
