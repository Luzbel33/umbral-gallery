import { test, expect } from "@playwright/test";

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
