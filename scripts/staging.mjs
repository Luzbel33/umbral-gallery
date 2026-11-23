import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
export function localStack() {
  const raw = JSON.parse(
    execFileSync(cli, ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  const url = new URL(raw.API_URL);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:")
    throw Error("Se requiere Supabase local en loopback.");
  return { url: url.origin, key: raw.ANON_KEY, admin: raw.SERVICE_ROLE_KEY };
}
export const stageURL = "http://127.0.0.1:5184/umbral-gallery/";
export async function serveStage() {
  const stack = localStack(),
    dir = path.resolve(".qa", "staging");
  await mkdir(dir, { recursive: true });
  execFileSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--outDir", dir],
    {
      stdio: "ignore",
      env: {
        ...process.env,
        VITE_SUPABASE_URL: stack.url,
        VITE_SUPABASE_PUBLISHABLE_KEY: stack.key,
      },
    },
  );
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
  };
  const cache = new Map();
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, stageURL).pathname);
      if (!pathname.startsWith("/umbral-gallery/")) {
        res.writeHead(404).end();
        return;
      }
      let name = pathname.slice("/umbral-gallery/".length) || "index.html";
      if (name.endsWith("/")) name = "index.html";
      const target = path.resolve(dir, name);
      if (!target.startsWith(dir + path.sep)) throw Error();
      let item = cache.get(target);
      if (!item) {
        const bytes = await readFile(target),
          ext = path.extname(target),
          compressed = [".css", ".js", ".html", ".svg"].includes(ext);
        item = {
          bytes: compressed ? gzipSync(bytes) : bytes,
          type: types[ext] || "application/octet-stream",
          compressed,
        };
        cache.set(target, item);
      }
      res.writeHead(200, {
        "Content-Type": item.type,
        "Content-Length": item.bytes.length,
        ...(item.compressed ? { "Content-Encoding": "gzip" } : {}),
      });
      res.end(item.bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok, no) =>
    server.once("error", no).listen(5184, "127.0.0.1", ok),
  );
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(
      new URL(import.meta.url).pathname
        .replace(/^\/([A-Z]:)/i, "$1")
        .replaceAll("%20", " "),
    )
) {
  await serveStage();
  console.log("Staging local listo en " + stageURL);
}
