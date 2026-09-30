import { expect, test } from "@playwright/test";

// Phone viewport, after the desktop specs have created the owner and content.

test("public page fits a phone screen with large enough touch targets", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const links = page.getByRole("region", { name: "Links" }).getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    expect((await links.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("the editor works on a phone: bottom tabs, add sheet, preview, sign out", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("e2e correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add to your page" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("region", { name: "Live preview of your page" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  for (const [label, path] of [["Appearance", /appearance/], ["Analytics", /analytics/], ["Settings", /settings/]] as const) {
    await page.getByRole("navigation", { name: "Main" }).last().getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(path);
    expect(await overflow()).toBeLessThanOrEqual(0);
  }

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
