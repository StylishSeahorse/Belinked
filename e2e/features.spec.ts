import { expect, test, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { mkdirSync } from "node:fs";

// Runs after flow.spec.ts (owner + content exist). Exercises the remaining admin features.

const EMAIL = "owner@example.com";
const PASSWORD = "e2e correct horse battery";
const shots = "test-results/screenshots";

/** A real 2x2 PNG so uploads pass signature and dimension checks. */
function pngBuffer() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 0]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test.describe.configure({ mode: "serial" });

let page: Page;
const errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  mkdirSync(shots, { recursive: true });
  page = await (await browser.newContext()).newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 400")) errors.push(message.text());
  });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

function flash(text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text });
}

test("uploads: accepts a real image, rejects a spoofed one", async () => {
  await page.goto("/admin/profile");
  await page.getByLabel("Upload profile picture").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: pngBuffer() });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(flash("Profile saved.")).toBeVisible();
  const avatar = await page.locator('input[name="avatarUrl"]').inputValue();
  expect(avatar).toMatch(/^\/uploads\/profile\/.+\.png$/);
  const served = await page.request.get(avatar);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["content-security-policy"]).toContain("sandbox");

  await page.getByLabel("Upload profile picture").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "does not match" })).toBeVisible();
  // Path traversal attempts on the upload route are refused.
  expect((await page.request.get("/uploads/..%2f..%2fpackage.json")).status()).toBe(404);
  await page.screenshot({ path: `${shots}/profile.png`, fullPage: true });
});

test("appearance: live preview updates and theme saves", async () => {
  await page.goto("/admin/themes");
  const preview = page.locator("[inert]");
  await expect(preview.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator('select[name="layout"]').selectOption("spotlight");
  await page.locator('select[name="buttonFill"]').selectOption("outline");
  // The live preview reflects the change before saving (outline buttons are transparent).
  await expect(preview.getByRole("link").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "Save theme" }).click();
  await expect(flash("Theme saved.")).toBeVisible();
  await expect(page.locator('select[name="layout"]')).toHaveValue("spotlight");
  await page.screenshot({ path: `${shots}/appearance.png`, fullPage: true });

  await page.goto("/admin/themes?edit=new#editor");
  await page.getByLabel("Theme name").fill("E2E Theme");
  await page.locator("fieldset", { hasText: "Background" }).locator("select").first().selectOption("gradient");
  await page.getByRole("button", { name: "Create theme" }).click();
  await expect(flash("Theme created.")).toBeVisible();
  const home = await page.request.get("/");
  expect(await home.text()).toContain("linear-gradient");
});

test("socials: platform is detected from the URL and email is normalized", async () => {
  await page.goto("/admin/socials");
  await page.getByLabel("URL, email, or phone").fill("https://bsky.app/profile/ada.bsky.social");
  await page.getByRole("button", { name: "Add social link" }).click();
  await expect(flash("Bluesky added.")).toBeVisible();
  await page.getByLabel("URL, email, or phone").fill("ada@example.com");
  await page.getByRole("button", { name: "Add social link" }).click();
  await expect(flash("Email added.")).toBeVisible();
  await page.getByRole("button", { name: "Move Email up" }).click();
  await expect(flash("Order updated.")).toBeVisible();
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('href="mailto:ada@example.com"');
  const visitor = await page.context().browser()!.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/");
  const hrefs = await pub.getByRole("navigation", { name: "Social profiles" }).getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["mailto:ada@example.com", "https://bsky.app/profile/ada.bsky.social"]);
  await visitor.close();
  await page.screenshot({ path: `${shots}/socials.png`, fullPage: true });
});

test("short links: create, redirect, reject duplicates, delete", async () => {
  await page.goto("/admin/short-links");
  await page.getByLabel("Code").first().fill("tour");
  await page.getByLabel("Destination").first().fill("https://tour.example.com/");
  await page.getByRole("button", { name: "Create short link" }).click();
  await expect(flash("/s/tour created")).toBeVisible();
  const redirect = await page.request.get("/s/tour", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toBe("https://tour.example.com/");

  await page.getByLabel("Code").first().fill("tour");
  await page.getByLabel("Destination").first().fill("https://other.example.com/");
  await page.getByRole("button", { name: "Create short link" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already in use" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("details", { hasText: "/s/tour" }).locator(":scope > summary").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(flash("deleted")).toBeVisible();
  expect((await page.request.get("/s/tour", { maxRedirects: 0 })).status()).toBe(404);
});

test("blocks: duplicate, CSV import, subscriber form and embeds render", async () => {
  await page.goto("/admin/blocks");
  const second = page.locator("details[id^=block-]", { hasText: "Second link" }).first();
  await second.locator(":scope > summary").click();
  await second.getByRole("button", { name: "Duplicate" }).click();
  await expect(flash("Block duplicated")).toBeVisible();

  await page.locator('input[name="csvFile"]').setInputFiles({ name: "links.csv", mimeType: "text/csv", buffer: Buffer.from("title,url\nImported,https://imported.example.com\nBad,javascript:alert(1)\n") });
  await page.getByRole("button", { name: "Import" }).click();
  await expect(flash("Imported 1 link, skipped 1 invalid row")).toBeVisible();

  const add = page.locator("#add-block");
  await add.locator(":scope > summary").click();
  await add.locator('select[name="type"]').selectOption("SUBSCRIBER_FORM");
  await add.getByLabel("Form title").fill("Join the list");
  await add.getByRole("button", { name: "Add block" }).click();
  await expect(flash("Block added")).toBeVisible();

  await add.locator(":scope > summary").click();
  await add.locator('select[name="type"]').selectOption("VIDEO");
  await add.getByLabel("Video title").fill("Latest video");
  await add.getByLabel("Video or share URL").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await add.getByRole("button", { name: "Add block" }).click();
  await expect(flash("Block added")).toBeVisible();
  await page.screenshot({ path: `${shots}/blocks.png`, fullPage: true });

  const visitor = await page.context().browser()!.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/");
  await expect(pub.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveAttribute("sandbox", /allow-scripts/);
  await pub.getByPlaceholder("Email address").fill("fan@example.com");
  await pub.getByRole("button", { name: "Subscribe" }).click();
  await expect(pub.getByText("Thanks, you are subscribed.")).toBeVisible();
  expect(await pub.content()).not.toContain("Imported");
  await pub.setViewportSize({ width: 390, height: 844 });
  await pub.screenshot({ path: `${shots}/public-mobile.png`, fullPage: true });
  await pub.setViewportSize({ width: 1440, height: 900 });
  await pub.screenshot({ path: `${shots}/public-desktop.png`, fullPage: true });
  await visitor.close();
});

test("2FA can be enabled and is required at next sign-in", async () => {
  const { totpCode } = await import("../lib/totp");
  await page.goto("/admin/settings#security");
  await page.getByRole("button", { name: "Set up 2FA" }).click();
  const secret = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel("6-digit code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Enable 2FA" }).click();
  await expect(flash("Two-factor authentication is enabled.")).toBeVisible();
  await page.screenshot({ path: `${shots}/settings.png`, fullPage: true });

  const other = await page.context().browser()!.newContext();
  const login = await other.newPage();
  await login.goto("/admin/login");
  await login.getByLabel("Email").fill(EMAIL);
  await login.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await login.getByRole("button", { name: "Sign in" }).click();
  await expect(login.getByLabel("Authentication code")).toBeVisible();
  await login.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await login.getByLabel("Authentication code").fill(totpCode(secret));
  await login.getByRole("button", { name: "Sign in" }).click();
  await expect(login).toHaveURL(/\/admin$/);
  await other.close();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Current password").nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: "Disable 2FA" }).click();
  await expect(flash("Two-factor authentication is disabled.")).toBeVisible();
});

test("backup download and guarded restore", async () => {
  await page.goto("/admin/settings#data");
  const download = await page.request.get("/api/export?type=all");
  const backup = await download.json();
  expect(backup.format).toBe("belinked-backup");
  expect(JSON.stringify(backup)).not.toContain("passwordHash");

  const file = { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) };
  await page.locator('input[name="backupFile"]').setInputFiles(file);
  await page.locator("#data").getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("Type RESTORE to confirm").fill("RESTORE");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore backup" }).click();
  await expect(flash(/Backup restored: \d+ blocks/)).toBeVisible();
});

test("analytics and dashboard render", async () => {
  await page.goto("/admin/analytics?days=30");
  await expect(page.getByRole("heading", { name: "Link performance" })).toBeVisible();
  await page.screenshot({ path: `${shots}/analytics.png`, fullPage: true });
  await page.goto("/admin");
  await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });
});

test("no browser errors across admin features", async () => {
  expect(errors).toEqual([]);
});
