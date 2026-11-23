import { chromium, webkit, devices } from "playwright";
import { expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { publicKey } from "../src/config.js";
import { localStack, serveStage } from "./staging.mjs";

const deployed = process.argv.includes("--deployed");
const site = deployed
  ? "https://luzbel33.github.io/umbral-gallery/"
  : "http://localhost:5184/umbral-gallery/";
const ref = "mlmhtoejxkoczykvahlh";
const server = deployed ? null : await serveStage();
function adminClient() {
  if (!deployed) {
    const s = localStack();
    return createClient(s.url, s.admin);
  }
  const keys = JSON.parse(
    execFileSync(
      process.platform === "win32" ? "supabase.exe" : "supabase",
      ["projects", "api-keys", "--project-ref", ref, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ),
  );
  return createClient(
    "https://" + ref + ".supabase.co",
    keys.find((k) => k.name === "service_role").api_key,
  );
}
const admin = adminClient();
const chromiumOptions = {
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--enable-unsafe-swiftshader"],
};
const cases = [
  [
    "desktop Chromium",
    chromium,
    chromiumOptions,
    { viewport: { width: 1440, height: 900 } },
  ],
  ["touch Chromium", chromium, chromiumOptions, devices["Pixel 7"]],
];
if (process.env.GALLERY_TEST_WEBKIT)
  cases.push(["touch WebKit", webkit, {}, devices["iPhone 13"]]);
const failures = [];
try {
  for (const [name, engine, launch, device] of cases.filter(
    ([name]) =>
      !process.env.GALLERY_TEST_CASE || name === process.env.GALLERY_TEST_CASE,
  )) {
    const browser = await engine.launch(launch);
    const p = await browser.newPage({ ...device, locale: "es-AR" });
    const handle = "media_" + randomBytes(6).toString("hex");
    let id, session;
    try {
      await p.goto(site + "?guia=1");
      await p.locator("#studio").click();
      await p.locator("[name=handle]").fill(handle);
      await p.locator("[name=password]").fill(randomBytes(16).toString("hex"));
      await p.locator("#auth-form [type=submit]").click();
      await p.locator("#account-done").click();
      session = await p.evaluate(() =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) => k.endsWith("-auth-token")),
          ),
        ),
      );
      id = session.user.id;
      const probe = await admin.rpc("probe_gallery_media", { owner_key: id });
      if (probe.error) throw probe.error;
      await p.locator("#studio").click();
      await p.locator("#create-room").click();
      await p.locator("[data-studio-tab=works]").click();
      await expect(p.locator("#storage-usage")).toContainText("48 MiB");
      for (const [index, file] of [
        "public/art/cylinder-06.mp3",
        process.env.GALLERY_TEST_FILM || "public/art/transito.mp4",
      ].entries()) {
        await p.locator("#upload-form input[type=file]").setInputFiles(file);
        await p.locator("#upload-form [name=optimize]").uncheck();
        await p.locator("#upload-form [type=submit]").click();
        try {
          await expect(p.locator(".work-row")).toHaveCount(index + 1, {
            timeout: 90000,
          });
        } catch (e) {
          console.log(
            name,
            file,
            await p.locator("#upload-form .form-status").textContent(),
          );
          throw e;
        }
      }
      const { data: rows, error } = await admin
        .from("works")
        .select("cloud_url,cloud_bytes,ready")
        .eq("room_id", id);
      if (
        error ||
        rows.length !== 2 ||
        !rows.every(
          (w) =>
            w.ready &&
            w.cloud_bytes > 0 &&
            w.cloud_url.startsWith("https://res.cloudinary.com/"),
        )
      )
        throw Error("Missing Cloudinary asset");
      await p.goto(site + "?sala=" + id);
      console.log(
        "UPLOAD",
        name,
        rows.map((x) => x.cloud_bytes),
      );
      const playbackErrors = [];
      for (const tag of ["audio", "video"]) {
        const el = p.locator(".pieces " + tag);
        await el.scrollIntoViewIfNeeded();
        try {
          const bounds = await el.boundingBox();
          const point = {
            x: 20,
            y:
              tag === "video"
                ? Math.max(4, bounds.height - 18)
                : bounds.height / 2,
          };
          if (device.hasTouch) await el.tap({ position: point });
          else await el.click({ position: point });
          await el.evaluate((media) =>
            media.paused ? media.play() : undefined,
          );
        } catch (e) {
          console.log(
            name,
            tag,
            e.message,
            await el.evaluate(async (m) => {
              const r = await fetch(m.currentSrc || m.src, { method: "HEAD" });
              return {
                status: r.status,
                type: r.headers.get("content-type"),
                reason: r.headers.get("x-cld-error"),
                mediaError: m.error?.message,
                extension: new URL(m.src).pathname.split(".").at(-1),
              };
            }),
          );
          playbackErrors.push(tag);
          continue;
        }
        await expect
          .poll(() => el.evaluate((m) => (m.error ? -1 : m.currentTime)), {
            timeout: 12000,
          })
          .toBeGreaterThan(0.25);
        await el.evaluate((m) => m.pause());
      }
      await p.locator("#studio").click();
      await p.locator("[data-studio-tab=works]").click();
      p.on("dialog", (d) => d.accept());
      for (const remaining of [1, 0]) {
        await p.locator("[data-remove]").first().click();
        await expect(p.locator(".work-row")).toHaveCount(remaining, {
          timeout: 30000,
        });
      }
      await expect(p.locator("#storage-usage")).toContainText("48 MiB");
      if (playbackErrors.length)
        throw Error("Playback did not start for " + playbackErrors.join(", "));
      console.log(
        "PASS",
        name,
        "MP3 and MP4 uploaded from file inputs, Cloudinary CDN playback advanced for both, deletion restored all 48 MiB",
        rows.map((x) => x.cloud_bytes),
      );
    } catch (e) {
      failures.push(name + ": " + e.message);
    } finally {
      try {
        if (session && id) {
          const { data: u } = await admin.auth.admin.getUserById(id);
          if (u?.user?.email !== handle + "@members.umbral.invalid")
            throw Error("Test identity mismatch");
          const { data: works, error } = await admin
            .from("works")
            .select("id,cloud_bytes")
            .eq("room_id", id);
          if (error) throw error;
          for (const w of works.filter((w) => w.cloud_bytes)) {
            const url =
              (deployed
                ? "https://" + ref + ".supabase.co"
                : localStack().url) +
              "/functions/v1/gallery-media?op=delete&work=" +
              w.id;
            const clean = () =>
              fetch(url, {
                method: "POST",
                headers: {
                  Origin: new URL(site).origin,
                  Authorization: "Bearer " + session.access_token,
                  apikey: deployed ? publicKey : localStack().key,
                },
              });
            let r = await clean();
            for (let tries = 0; r.status === 409 && tries < 12; tries++) {
              await new Promise((ok) => setTimeout(ok, 10000));
              r = await clean();
            }
            if (!r.ok)
              throw Error("Temporary media cleanup failed " + r.status);
          }
          const d = await admin.auth.admin.deleteUser(id);
          if (d.error) throw d.error;
        }
      } finally {
        await browser.close();
      }
    }
  }
  if (failures.length) throw Error(failures.join("\n"));
} finally {
  server?.close();
}
