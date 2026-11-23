import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localStack, serveStage } from "../scripts/staging.mjs";
import { readFile } from "node:fs/promises";
const site = "http://localhost:5184/umbral-gallery/";
const stack = localStack(),
  db = createClient(stack.url, stack.admin);
const server = await serveStage();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
  ],
});
const actors = [],
  tag = "QA piloto " + Date.now(),
  errors = [];
async function actor(mobile = false, credential = null) {
  const ctx = await browser.newContext({
    locale: "es-AR",
    viewport: mobile
      ? { width: 375, height: 812 }
      : { width: 1440, height: 950 },
    isMobile: mobile,
    hasTouch: mobile,
    permissions: ["microphone"],
  });
  const p = await ctx.newPage(),
    cdp = await ctx.newCDPSession(p);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  if (credential)
    await cdp.send("WebAuthn.addCredential", { authenticatorId, credential });
  await p.addInitScript(() => {
    window.qaRMS = 0;
    window.qaTracks = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      if (this.buffer?.sampleRate === 8000) {
        const s = this.buffer.getChannelData(0);
        window.qaRMS = Math.max(
          window.qaRMS,
          Math.sqrt(s.reduce((x, y) => x + y * y, 0) / s.length),
        );
      }
      return start.apply(this, a);
    };
    const orig = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (...a) => {
      const s = await orig(...a);
      window.qaTracks.push(...s.getTracks());
      return s;
    };
  });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      msg.text().includes("Content Security Policy")
    )
      console.log("CSP", msg.text().slice(0, 240));
  });
  await p.goto(site);
  await p.locator("#catalog-title").waitFor();
  return { ctx, p, cdp, authenticatorId };
}
async function account(a, name, register = true) {
  const p = a.p;
  await p
    .getByRole("button", {
      name: register ? "Registrarme" : "Ingresar",
      exact: true,
    })
    .click();
  if (register) await p.locator("#auth-form input").fill(name);
  await p.locator("#auth-form button[type=submit]").click();
  try {
    await expect(p.locator("#studio-label")).toHaveText("Mi espacio", {
      timeout: 20000,
    });
  } catch (e) {
    console.log("Auth feedback", await p.locator("dialog").innerText());
    throw e;
  }
  const id = await p.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.endsWith("auth-token")),
        ),
      ).user.id,
  );
  if (register) actors.push([id, name]);
  return id;
}
function pdf() {
  const parts = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 180] /Contents 4 0 R >>",
    "<< /Length 29 >>\nstream\n0 .6 0 rg 10 10 100 100 re f\nendstream",
  ];
  let s = "%PDF-1.4\n",
    positions = [0];
  for (let i = 0; i < parts.length; i++) {
    positions.push(s.length);
    s += i + 1 + " 0 obj\n" + parts[i] + "\nendobj\n";
  }
  const off = s.length;
  s +=
    "xref\n0 5\n0000000000 65535 f \n" +
    positions
      .slice(1)
      .map((p) => String(p).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" +
    off +
    "\n%%EOF";
  return Buffer.from(s);
}
const uploadFiles = [
  ["demo.py", "text/plain", Buffer.from('print("Hola desde Umbral")')],
  ["serie.csv", "text/csv", Buffer.from("nombre,serie\nsur,17\nnorte,29")],
  [
    "pieza.obj",
    "text/plain",
    Buffer.from(
      "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 2 3\nf 1 3 4\nf 1 4 2\nf 2 4 3",
    ),
  ],
  ["memoria.pdf", "application/pdf", pdf()],
  ["obra.webp", "image/webp", await readFile("public/art/orbital.webp")],
  ["banda.mp3", "audio/mpeg", await readFile("public/art/cylinder-06.mp3")],
  ["obra-video.mp4", "video/mp4", await readFile("public/art/transito.mp4")],
];
const a = await actor(),
  b = await actor(true);
const p = a.p,
  phone = b.p;
try {
  await expect(phone.locator(".card").first()).toBeVisible();
  await phone
    .locator(".card img")
    .first()
    .evaluate((i) => i.decode());
  await phone.screenshot({ path: ".qa/home-mobile.png", fullPage: true });
  await p.screenshot({ path: ".qa/home-desktop.png", fullPage: true });
  const id = await account(a, tag + " A");
  await account(b, tag + " B");
  const guest = createClient(stack.url, stack.key, {
    auth: { persistSession: false },
  });
  if (
    !(await guest.rpc("create_my_gallery")).error ||
    !(
      await guest.rpc("set_gallery_favorite", {
        room_key: "orbital",
        saved: true,
      })
    ).error
  )
    throw Error("A guest could write account data");
  if (db) {
    const r = await db.from("rooms").select("id").eq("id", id);
    if (r.error || r.data.length)
      throw Error("Automatic room provisioning still enabled");
  }
  await p.locator("[data-save=orbital]").click();
  await expect(p.locator("[data-save=orbital]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const cred = (
      await a.cdp.send("WebAuthn.getCredentials", {
        authenticatorId: a.authenticatorId,
      })
    ).credentials[0],
    other = await actor(true, cred);
  await account(other, "", false);
  await other.p.locator("#saved-link").click();
  await expect(other.p.locator(".card").first()).toContainText(
    "Materia orbital",
  );
  await other.ctx.close();
  console.log("PASS optional account, repeat login and cross-device favorite");
  await p.locator("#studio").click();
  await expect(p.getByRole("heading", { name: "Mi espacio" })).toBeVisible();
  await p.locator("#create-room").click();
  const access = await phone.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.endsWith("auth-token")),
        ),
      ).access_token,
  );
  const visitor = createClient(stack.url, stack.key, {
    accessToken: async () => access,
  });
  const hidden = await visitor.from("rooms").select("id").eq("id", id);
  const edit = await visitor
    .from("rooms")
    .update({ title: "Cambio de prueba" })
    .eq("id", id)
    .select("id");
  if (hidden.error || edit.error || hidden.data.length || edit.data.length)
    throw Error("Private room ownership was not enforced");
  await p.locator("#room-form").waitFor();
  await p.locator("#room-form [name=title]").fill("Ensayo del estudio");
  await p.locator("select[name=category]").selectOption("Programación");
  await p
    .getByLabel("Biografía del artista")
    .fill("Autor de la exposición de prueba.");
  await p
    .getByLabel("Repositorio o demo")
    .fill("https://github.com/Luzbel33/umbral-gallery");
  await p.getByLabel("Sitio web", { exact: true }).fill("https://example.org");
  await p
    .getByLabel("Red social", { exact: true })
    .fill("https://example.org/social");
  await p.getByLabel("Mostrar mi sala").check();
  await p.locator("#room-form [type=submit]").click();
  await expect(p.locator("#room-form .form-status")).toHaveText(
    "Cambios guardados.",
  );
  await p.getByRole("button", { name: "Obras y archivos" }).click();
  for (const [name, mimeType, buffer] of uploadFiles) {
    await p
      .locator("#upload-form input[type=file]")
      .setInputFiles({ name, mimeType, buffer });
    await p.locator("#upload-form button[type=submit]").click();
    try {
      await expect(p.locator(".work-row")).toHaveCount(
        uploadFiles.findIndex((f) => f[0] === name) + 1,
        { timeout: 18000 },
      );
    } catch (e) {
      console.log(
        "Upload",
        name,
        await p.locator("#upload-form .form-status").innerText(),
      );
      throw e;
    }
  }
  await p.getByRole("button", { name: "Sala y enlaces" }).click();
  await p.getByLabel("Música ambiente").selectOption({ label: "banda" });
  await p.locator("#room-form [type=submit]").click();
  await expect(p.locator("#room-form .form-status")).toHaveText(
    "Cambios guardados.",
  );
  await phone.goto(site + "?sala=" + id);
  await expect(phone.locator(".pieces article")).toHaveCount(7);
  await expect(phone.locator(".artist-profile")).toContainText(
    "Autor de la exposición de prueba.",
  );
  for (const [title, sel] of [
    ["demo", "pre"],
    ["serie", "table"],
    ["pieza", "canvas.model-canvas"],
    ["memoria", "canvas"],
  ]) {
    await phone
      .locator(".pieces article")
      .filter({ has: phone.getByRole("heading", { name: title, exact: true }) })
      .locator("[data-piece]")
      .click();
    try {
      await expect(phone.locator("#file-view " + sel)).toBeVisible({
        timeout: 16000,
      });
      if (title === "memoria")
        await expect(phone.locator(".pdf-bar")).toContainText("1 / 1", {
          timeout: 12000,
        });
      if (title === "demo")
        await expect(phone.locator("#file-view pre")).toContainText(
          "Hola desde Umbral",
        );
    } catch (e) {
      console.log(
        "Viewer",
        title,
        await phone.locator("#file-view").innerText(),
      );
      throw e;
    }
    await phone.locator("[data-close]").click();
  }
  await expect(phone.locator(".profile-links a")).toHaveCount(3);
  const durations = await phone
    .locator(".pieces audio,.pieces video")
    .evaluateAll((els) =>
      Promise.all(
        els.map(
          (el) =>
            new Promise((ok) => {
              el.onloadedmetadata = () => ok(el.duration);
              el.onerror = () => ok(0);
              el.load();
            }),
        ),
      ),
    );
  if (durations.some((x) => x <= 0)) throw Error("Invalid media");
  console.log(
    "PASS seven media uploads, code/table/PDF/3D viewers, video, music and artist links",
  );
  await p.locator("[data-close]").click();
  for (const q of [p, phone]) {
    await q.goto(site + "?sala=patio");
    await q.locator("#join-patio").click();
    await q.locator("#chat-message").waitFor();
  }
  await p.locator("#chat-message").fill("Saludo de prueba");
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(phone.locator("[data-log]")).toContainText("Saludo de prueba", {
    timeout: 9000,
  });
  await phone.screenshot({ path: ".qa/patio-mobile.png", fullPage: true });
  for (const q of [p, phone]) {
    await q.locator("[data-listen]").click();
    try {
      await expect(q.locator("[data-talk]")).toBeEnabled({ timeout: 15000 });
    } catch (e) {
      console.log(
        "Listen status",
        await q.locator("[data-feedback]").innerText(),
      );
      throw e;
    }
  }
  await p.locator("[data-talk]").focus();
  await p.keyboard.down("Space");
  await p.waitForTimeout(4400);
  await p.keyboard.up("Space");
  try {
    await expect
      .poll(() => phone.evaluate(() => window.qaRMS), { timeout: 14000 })
      .toBeGreaterThan(0.003);
  } catch (e) {
    console.log(
      "Voice diagnostics",
      await p.locator("[data-feedback]").innerText(),
      await phone.locator("[data-feedback]").innerText(),
      await p.evaluate(() => window.qaTracks.map((t) => t.readyState)),
    );
    throw e;
  }
  if (
    !(await p.evaluate(
      () =>
        window.qaTracks.length &&
        window.qaTracks.every((t) => t.readyState === "ended"),
    ))
  )
    throw Error("Microphone stayed on");
  console.log(
    "PASS two-account text and audio delivery, decoded audio RMS",
    await phone.evaluate(() => window.qaRMS),
    "microphone released",
  );
  await phone.goto(site + "?sala=patio&modo=3d");
  await phone.locator("#viewport canvas").waitFor();
  await phone.screenshot({ path: ".qa/patio-3d-mobile.png" });
  await p.goto(site + "?sala=" + id + "&modo=3d");
  await p.locator("#sound").click();
  await expect(p.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await p.goto(site);
  await p.locator("#studio").click();
  await p.getByLabel("Mostrar mi sala").uncheck();
  await p.locator("#room-form [type=submit]").click();
  await expect(p.locator("#room-form .form-status")).toHaveText(
    "Cambios guardados.",
  );
  await p.getByRole("button", { name: "Obras y archivos" }).click();
  p.on("dialog", (d) => d.accept());
  while (await p.locator("[data-remove]").count()) {
    const count = await p.locator("[data-remove]").count();
    await p.locator("[data-remove]").first().click();
    await expect(p.locator("[data-remove]")).toHaveCount(count - 1);
  }
  if (errors.length) throw Error(errors.join("; "));
  console.log("PASS room soundtrack, courtyard walk, unpublish and removal");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close();
  if (db) {
    for (const [id, label] of actors) {
      const r = await db
        .from("works")
        .select("id,extension,has_preview")
        .eq("room_id", id);
      if (r.data?.length)
        await db.storage
          .from("gallery-art")
          .remove(
            r.data.flatMap((w) => [
              id + "/" + w.id + "." + w.extension,
              ...(w.has_preview ? [id + "/" + w.id + ".preview.webp"] : []),
            ]),
          );
      const u = await db.auth.admin.getUserById(id);
      if (u.data?.user?.user_metadata.artist === label) {
        await db.auth.admin.deleteUser(id);
        await db
          .from("gallery_passkeys")
          .delete()
          .eq("identity", u.data.user.email.split("@")[0]);
      }
    }
  }
}
