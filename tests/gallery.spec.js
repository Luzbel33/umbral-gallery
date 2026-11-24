import { test, expect } from "@playwright/test";

test("visual mounting shares positions, sculpture angles and finishes with the web editor", async ({ page }, info) => {
  await page.goto("./?sala=taller&modo=3d&lang=es");
  await page.locator("#edit-installation").click();
  await expect(page.locator(".visual-tools")).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.locator("[data-work]").selectOption("fold");
  await page.locator("[data-place='1']").click();
  await expect(page.locator("[data-place='1']")).toHaveClass(/current-mount/);
  await page.locator("[data-angle]").fill("37");
  await page.locator("[data-wall='2']").click();
  await page.locator("[data-place='7']").click();
  await expect(page.locator("[data-place='7']")).toHaveClass(/current-mount/);
  const zoom = page.locator(".mount-zoom");
  if (await zoom.getAttribute("aria-pressed") === "false") await zoom.click();
  await page.screenshot({ path: `.qa/visual-mount-${info.project.name}.png` });
  await page.locator("[data-mode='room']").click();
  await page.locator("[data-finish='Madera']").click();
  await page.locator("[data-paint]").fill("#77845a");
  await expect(page.locator(".visual-status")).toHaveText("Cambios guardados.");
  await page.locator(".visual-close").click();
  await expect(page.locator(".mount-points")).toHaveCount(0);
  await page.locator("#edit-installation").click();
  await page.locator(".visual-files").click();
  await expect(page.locator("#upload-form")).toBeVisible();
  await page.locator('[data-studio-tab="room"]').click();
  await expect(page.locator("[name=finish]")).toHaveValue("Madera");
  await expect(page.locator("[name=wall_color]")).toHaveValue("#77845a");
  await page.locator("[data-studio-tab='works']").click();
  await expect(page.locator("[data-edit='study']")).toContainText("Fondo derecho");
  await expect(page.locator("[data-edit='fold']")).toContainText("Entrada central");
  await page.locator("[data-edit='fold']").click();
  await expect(page.locator("[name=orientation]")).toHaveValue("37");
});

test("removing the last image and recording leaves a sculpture-only room", async ({ page }) => {
  await page.goto("./?sala=taller&lang=es");
  await page.locator("[data-demo]").click();
  await page.locator('[data-studio-tab="works"]').click();
  await expect(page.locator(".budget-help")).toContainText("2 MB");
  page.on("dialog", (dialog) => dialog.accept());
  for (const id of ["study", "track"]) {
    await page.locator(`[data-remove="${id}"]`).click();
  }
  await expect(page.locator("#quota")).toHaveText("1 / 4");
  await page.locator("#panel [data-close]").click();
  await expect(page.locator(".pieces article")).toHaveCount(1);
  await expect(page.locator(".pieces")).toContainText("Abanico de cobre");
  await expect(page.locator(".detail-cover .room-art")).toBeVisible();
  await expect(page.locator(".detail-cover img, .room-art > *, .pieces img, .pieces audio, .pieces video")).toHaveCount(0);
  await page.getByRole("link", { name: "Recorrer en 3D" }).click();
  await page.locator("#artist-card").click();
  await expect(page.locator(".artist-index [data-piece]")).toHaveCount(1);
  await expect(page.locator(".artist-index")).toContainText("Abanico de cobre");
});

test("walk and turn with two thumbs, then release the analog stick", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "This gesture requires a touch viewport.");
  const positions = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/rpc/gallery_updates"))
      positions.push(r.postDataJSON());
  });
  await page.goto("./?sala=patio&modo=3d");
  const stick = page.getByRole("group", { name: "Joystick de movimiento" });
  await expect(stick).toBeVisible();
  await page.locator("#visits").click();
  await expect.poll(() => positions.length).toBeGreaterThan(0);
  const start = positions.at(-1),
    rect = await stick.boundingBox(),
    x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const device = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) =>
    device.send("Input.dispatchTouchEvent", { type, touchPoints });
  await touch("touchStart", [{ x, y, id: 0 }]);
  await touch("touchMove", [{ x: x + 17, y: y - 15, id: 0 }]);
  await expect(stick).toHaveClass(/engaged/);
  await touch("touchStart", [
    { x: x + 17, y: y - 15, id: 0 },
    { x: 285, y: 340, id: 1 },
  ]);
  await touch("touchMove", [
    { x: x + 17, y: y - 15, id: 0 },
    { x: 242, y: 346, id: 1 },
  ]);
  await expect
    .poll(
      () =>
        positions.some(
          (p) =>
            Math.hypot(p.px - start.px, p.pz - start.pz) > 0.2 &&
            Math.abs(p.angle - start.angle) > 0.08,
        ),
      { timeout: 10000 },
    )
    .toBe(true);
  await touch("touchEnd", []);
  await expect(stick).not.toHaveClass(/engaged/);
  await page.getByRole("button", { name: "Modo web" }).click();
});

test("discover, filter, save and revisit an exhibition", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Explorar salas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exposición siguiente" }).click();
  await expect(page.locator("#hero-title")).toContainText("Frecuencia");
  if (await page.locator("#filters-toggle").isVisible())
    await page.locator("#filters-toggle").click();
  await page.getByRole("button", { name: "Música", exact: true }).click();
  await expect(page.locator(".card").first()).toContainText("Frecuencia azul");
  await page
    .locator(".card")
    .first()
    .getByRole("button", { name: "Guardar sala" })
    .click();
  await page.getByRole("link", { name: "Guardadas", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.getByRole("link", { name: "Abrir Frecuencia azul" }).click();
  await expect(
    page.getByRole("heading", { name: "Obras en sala" }),
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute("controls", "");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Frecuencia azul", exact: true }),
  ).toBeVisible();
});

test("walk, use controls and return to the web exhibition", async ({
  page,
}) => {
  const blocked = [];
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /Content Security Policy|load texture/i.test(m.text())
    )
      blocked.push(m.text());
  });
  await page.goto("./?sala=orbital&modo=3d");
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  expect(blocked).toEqual([]);
  await page.getByRole("button", { name: "Controles de movimiento" }).click();
  await expect(
    page.getByRole("heading", { name: "Cómo recorrer la sala" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.keyboard.down("w");
  await page.waitForTimeout(300);
  await page.keyboard.up("w");
  await page.getByRole("button", { name: "Modo web" }).click();
  await expect(
    page.getByRole("heading", { name: "Materia orbital", exact: true }),
  ).toBeVisible();
});

test("desktop mouse turns the camera without a mouse button", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile);
  const poses = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/rpc/gallery_updates")) poses.push(r.postDataJSON());
  });
  await page.goto("./?sala=frecuencia&modo=3d");
  await page.locator("#visits").click();
  await expect.poll(() => poses.length).toBeGreaterThan(0);
  const yaw = poses.at(-1).angle;
  await page.mouse.move(440, 360);
  await page.mouse.move(740, 345, { steps: 12 });
  await expect
    .poll(() => poses.some((p) => Math.abs(p.angle - yaw) > 0.25), {
      timeout: 10000,
    })
    .toBe(true);
  await page.locator("#leave").click();
});
test("the browser language is detected and the visitor's choice survives navigation", async ({
  browser,
  baseURL,
}) => {
  for (const [locale, expected] of [
    ["es-MX", "es"],
    ["de-DE", "en"],
    ["en-US", "en"],
  ]) {
    const context = await browser.newContext({ locale });
    try {
      const page = await context.newPage();
      await page.goto(baseURL);
      await expect(page.locator("html")).toHaveAttribute("lang", expected);
      const next = expected === "en" ? "es" : "en";
      await page.locator("#language-switch").click();
      await expect(page.locator("html")).toHaveAttribute("lang", next);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", next);
      await page.locator("#hero-detail").click();
      await expect(page.locator(".artist-profile")).toContainText("USGS EROS");
    } finally {
      await context.close();
    }
  }
});
test("the cinema projects on demand and the atrium track starts on request", async ({
  page,
}) => {
  await page.goto("./?sala=intervalos&modo=3d");
  await page.locator(".film-control").click();
  await expect(page.locator(".film-control")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".film-control").click();
  await expect(page.locator(".film-control")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.goto("./?sala=patio&modo=3d");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#artist-card").click();
  await expect(page.locator("#panel")).toContainText("Cylinder Six");
});
