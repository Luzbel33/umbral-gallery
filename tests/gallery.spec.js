import { test, expect } from "@playwright/test";

test("walk and turn with two thumbs, then release the analog stick", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "This gesture requires a touch viewport.");
  const positions = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/rpc/gallery_snapshot"))
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
  await page.goto("./?sala=orbital&modo=3d");
  await expect(page.locator("#viewport canvas")).toBeVisible();
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
