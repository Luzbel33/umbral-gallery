import { expect } from "@playwright/test";
import { chromium, devices, webkit } from "playwright";
import { pathToFileURL } from "node:url";

export async function checkPlayback(page, kind, hasTouch) {
  const el = page.locator(".pieces " + kind).first();
  await el.scrollIntoViewIfNeeded();
  const src = new URL(await el.evaluate((m) => m.currentSrc || m.src));
  const failures = [];
  const onResponse = (r) => {
    if (r.url() === src.href && r.status() >= 400)
      failures.push(r.status() + " " + (r.headers()["x-cld-error"] || ""));
  };
  page.on("response", onResponse);
  try {
    const box = await el.boundingBox();
    const position = {
      x: 18,
      y: kind === "audio" ? box.height / 2 : box.height - 18,
    };
    if (hasTouch === "android") {
      const session = await page.context().newCDPSession(page);
      try {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: box.x + position.x, y: box.y + position.y }],
        });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } finally {
        await session.detach();
      }
    } else if (hasTouch) await el.tap({ position });
    else await el.click({ position });
    // Native control placement varies by OS. A trusted page gesture also
    // allows the native player API to start on browsers with autoplay limits.
    if (await el.evaluate((m) => m.paused))
      await el.evaluate((m) =>
        Promise.race([
          m.play(),
          new Promise((_, reject) =>
            setTimeout(() => reject(Error("play timed out")), 12000),
          ),
        ]),
      );
    await expect
      .poll(() => el.evaluate((m) => m.currentTime), { timeout: 15000 })
      .toBeGreaterThan(0.35);
    const target = await el.evaluate((m) => {
      if (!Number.isFinite(m.duration) || m.duration <= 1.5)
        throw Error("Invalid duration");
      return Math.min(m.duration / 2, 4);
    });
    await el.evaluate((m, t) => {
      m.currentTime = t;
    }, target);
    await expect
      .poll(() => el.evaluate((m) => !m.seeking && m.currentTime), {
        timeout: 12000,
      })
      .toBeGreaterThan(target + 0.2);
    if (kind === "video")
      await expect
        .poll(() => el.evaluate((m) => m.videoWidth))
        .toBeGreaterThan(0);
    console.log("PASS", kind, src.host, "played, sought and resumed");
  } catch (e) {
    const state = await el.evaluate((m) => ({
      code: m.error?.code,
      message: m.error?.message,
      paused: m.paused,
      time: m.currentTime,
      readyState: m.readyState,
    }));
    throw Error(
      kind +
        " " +
        src.host +
        " " +
        JSON.stringify({ state, failures }) +
        " " +
        e.message,
    );
  } finally {
    page.off("response", onResponse);
    await el.evaluate((m) => m.pause());
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const id = process.env.GALLERY_ROOM || "";
  if (id && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
    throw Error("Expected a gallery room UUID");
  const site = "https://luzbel33.github.io/umbral-gallery/?sala=";
  const chrome = { channel: "chrome" };
  const cases = [
    [
      "desktop Chrome",
      chromium,
      chrome,
      { viewport: { width: 1440, height: 900 } },
    ],
    ["Pixel touch Chrome", chromium, chrome, devices["Pixel 7"]],
    ["iPhone touch WebKit", webkit, {}, devices["iPhone 13"]],
  ];
  const failures = [];
  async function visit(p, label, touch) {
    for (const [tag, example] of [
      ["audio", "frecuencia"],
      ["video", "intervalos"],
    ]) {
      try {
        await p.goto(site + (id || example));
        console.log(label, id || example);
        await checkPlayback(p, tag, touch);
      } catch (e) {
        failures.push(label + ": " + e.message);
      }
    }
  }
  if (process.argv.includes("--android")) {
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
      const p = await browser.contexts()[0].newPage();
      if (
        !(await p.evaluate(
          () =>
            navigator.userAgent.includes("Android") &&
            navigator.maxTouchPoints > 0,
        ))
      )
        throw Error("Expected Chrome running on Android");
      console.log("Android Chrome", browser.version());
      await visit(p, "Android", "android");
    } finally {
      await browser.close();
    }
  } else {
    for (const [label, engine, options, device] of cases) {
      const browser = await engine.launch(options);
      try {
        // A fresh visitor has no login, artist token or storage privilege.
        const p = await browser.newPage({ ...device, locale: "es-AR" });
        await visit(p, label, !!device.hasTouch);
      } finally {
        await browser.close();
      }
    }
  }
  if (failures.length) throw Error(failures.join("\n"));
}
