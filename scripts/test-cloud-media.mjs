import { chromium, webkit, devices } from "playwright";
import { expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { publicKey } from "../src/config.js";
import { localStack, serveStage } from "./staging.mjs";

import { checkPlayback } from "./public-playback.mjs";
import { stat } from "node:fs/promises";

const activeStorage = process.argv.includes("--active-storage");
const independent = process.argv.includes("--independent");
const optimize = process.argv.includes("--optimize");
const deployed = process.argv.includes("--deployed");
const site = deployed
  ? "https://luzbel33.github.io/umbral-gallery/"
  : "http://localhost:5184/umbral-gallery/";
if (independent && !deployed)
  throw Error("Independent visitors require a hosted public room");

async function independentVisitor(id) {
  const repo = "Luzbel33/umbral-gallery";
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
  gh(
    "workflow",
    "run",
    "public-playback.yml",
    "--repo",
    repo,
    "--ref",
    "main",
    "-f",
    "room=" + id,
  );
  for (let i = 0; i < 36; i++) {
    const runs = JSON.parse(
      gh(
        "run",
        "list",
        "--repo",
        repo,
        "--workflow",
        "public-playback.yml",
        "--limit",
        "20",
        "--json",
        "databaseId,displayTitle",
      ),
    );
    const run = runs.find((r) => r.displayTitle === "Public playback " + id);
    if (run) {
      console.log(
        "Independent signed-out browser check: https://github.com/" +
          repo +
          "/actions/runs/" +
          run.databaseId,
      );
      execFileSync(
        "gh",
        [
          "run",
          "watch",
          String(run.databaseId),
          "--repo",
          repo,
          "--exit-status",
          "--compact",
          "--interval",
          "10",
        ],
        { stdio: ["ignore", "ignore", "inherit"], timeout: 15 * 60 * 1000 },
      );
      return;
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw Error("Could not locate the dispatched public visitor check");
}
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
async function ownerBudget(session) {
  const { url, key } = deployed
    ? { url: "https://" + ref + ".supabase.co", key: publicKey }
    : localStack();
  const r = await fetch(url + "/rest/v1/rpc/my_gallery_budget", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!r.ok)
    throw Error("Could not read the artist's storage budget: " + r.status);
  return r.json();
}
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
const selected = cases.filter(
  ([label]) =>
    !process.env.GALLERY_TEST_CASE || label === process.env.GALLERY_TEST_CASE,
);
try {
  if (
    !selected.length ||
    (independent && !selected.some(([label]) => label === "desktop Chromium"))
  )
    throw Error("Selected browser cases cannot run the requested checks");
  for (const [name, engine, launch, device] of selected) {
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
      if (!activeStorage) {
        const probe = await admin.rpc("probe_gallery_media", { owner_key: id });
        if (probe.error) throw probe.error;
      }
      await p.locator("#studio").click();
      await p.locator("#create-room").click();
      await p.locator("[data-studio-tab=works]").click();
      const initialBudget = await ownerBudget(session);
      const usage = p.locator("#storage-usage");
      await expect(usage).toContainText("Disponibles ahora");
      if (initialBudget.cloud) await expect(usage).toContainText(/50[.,]33 MB/);
      if (
        initialBudget.used !== 0 ||
        initialBudget.available < 6 * 1024 ** 2 ||
        (initialBudget.cloud && initialBudget.available !== 48 * 1024 ** 2)
      )
        throw Error("Temporary room did not start with the expected budget");
      const files = [
        process.env.GALLERY_TEST_AUDIO || "public/art/cylinder-06.mp3",
        process.env.GALLERY_TEST_FILM || "public/art/transito.mp4",
      ];
      const preparedSizes = [];
      for (const [index, file] of files.entries()) {
        await p.locator("#upload-form input[type=file]").setInputFiles(file);
        if (index === 0)
          await p
            .locator("#upload-form [name=title]")
            .fill("Cylinder Six · Chris Zabriskie");
        await p.locator("#upload-form [name=optimize]").setChecked(optimize);
        const estimate = p.locator("#file-estimate");
        await expect(estimate).toContainText("Se subirán", { timeout: 120000 });
        const bytes = (await estimate.getAttribute("title"))?.match(/^([\d.,\s]+) B$/);
        if (!bytes) throw Error("Missing exact upload estimate");
        preparedSizes.push(Number(bytes[1].replace(/\D/g, "")));
        await p.locator("#upload-form [type=submit]").click();
        try {
          const status = p.locator("#upload-form .form-status");
          await expect(status).not.toHaveText(
            "Preparando y subiendo el archivo…",
            { timeout: 100000 },
          );
          if (!(await status.textContent()).includes("Obra subida."))
            throw Error("Upload feedback: " + (await status.textContent()));
          await expect(p.locator(".work-row")).toHaveCount(index + 1);
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
      if (error || rows.length !== 2 || rows.some((w) => !w.ready))
        throw Error("Missing uploaded artwork");
      const cloud = rows.every((w) =>
        w.cloud_url?.startsWith("https://res.cloudinary.com/"),
      );
      if (
        !cloud &&
        (!activeStorage || rows.some((w) => w.cloud_bytes || w.cloud_url))
      )
        throw Error("Unexpected storage provider");
      const fileSizes = await Promise.all(
        files.map(async (file) => (await stat(file)).size),
      );
      if (
        preparedSizes.some((n, i) =>
          optimize ? n > fileSizes[i] : n !== fileSizes[i],
        )
      )
        throw Error("Unexpected size in the editor's upload estimate");
      const expectedBytes = preparedSizes.reduce((sum, size) => sum + size, 0);
      const actualBudget = await ownerBudget(session);
      if (
        actualBudget.cloud !== cloud ||
        actualBudget.used !== expectedBytes ||
        (cloud &&
          actualBudget.available !== initialBudget.available - expectedBytes)
      )
        throw Error(
          "The artist's available bytes do not match the two uploaded files",
        );
      const expectedSizes = [...preparedSizes].sort((a, b) => a - b);
      if (
        cloud &&
        !rows
          .map((w) => w.cloud_bytes)
          .sort((a, b) => a - b)
          .every((n, i) => n === expectedSizes[i])
      )
        throw Error("Stored media sizes differ from the selected files");
      console.log("UPLOAD", name, cloud ? "Cloudinary" : "Supabase Storage", {
        original: fileSizes,
        stored: preparedSizes,
      });
      await p.locator("[data-studio-tab=room]").click();
      await p
        .locator("#room-form [name=title]")
        .fill("Umbral · playback verification");
      await p
        .locator("#room-form [name=description]")
        .fill(
          "Cylinder Six by Chris Zabriskie (https://chriszabriskie.com/cylinders/), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).",
        );
      await p.locator("#room-form [name=published]").check();
      await p.locator("#room-form [type=submit]").click();
      await expect(p.locator("#room-form .form-status")).toHaveText(
        "Cambios guardados.",
      );
      const visitor = await browser.newPage({ ...device, locale: "es-AR" });
      const playbackErrors = [];
      try {
        await visitor.goto(site + "?sala=" + id);
        for (const tag of ["audio", "video"]) {
          try {
            await checkPlayback(visitor, tag, !!device.hasTouch);
          } catch (e) {
            console.error(name, e.message);
            playbackErrors.push(tag);
          }
        }
        if (independent && name === "desktop Chromium") {
          try {
            await independentVisitor(id);
          } catch (e) {
            playbackErrors.push("independent network: " + e.message);
          }
        }
      } finally {
        await visitor.close();
      }
      await p.locator("#room-form [name=published]").uncheck();
      await p.locator("#room-form [type=submit]").click();
      await expect(p.locator("#room-form .form-status")).toHaveText(
        "Cambios guardados.",
      );
      await p.locator("[data-studio-tab=works]").click();
      p.on("dialog", (d) => d.accept());
      for (const remaining of [1, 0]) {
        await p.locator("[data-remove]").first().click();
        await expect(p.locator(".work-row")).toHaveCount(remaining, {
          timeout: 30000,
        });
      }
      if (cloud) await expect(usage).toContainText(/50[.,]33 MB/);
      const finalBudget = await ownerBudget(session);
      if (
        finalBudget.used !== 0 ||
        (cloud && finalBudget.available !== initialBudget.available)
      )
        throw Error("Removing both files did not restore the room budget");
      if (playbackErrors.length)
        throw Error("Playback did not start for " + playbackErrors.join(", "));
      console.log(
        "PASS",
        name,
        "Audio and video uploaded through the editor, guest playback and seeking passed, both works removed",
        preparedSizes,
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
            .select("id,cloud_bytes,extension,has_preview")
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
          const stored = works
            .filter((w) => !w.cloud_bytes)
            .flatMap((w) => [
              id + "/" + w.id + "." + w.extension,
              ...(w.has_preview ? [id + "/" + w.id + ".preview.webp"] : []),
            ]);
          if (stored.length) {
            const removed = await admin.storage
              .from("gallery-art")
              .remove(stored);
            if (removed.error) throw removed.error;
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
