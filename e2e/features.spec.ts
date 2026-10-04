import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

// Runs after flow.spec.ts (owner + content exist). Exercises the rest of the editor.

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

/** A ~2.4MB PNG: larger than Next's default 1MB server-action body limit. */
function largePng() {
  const width = 900;
  const height = 900;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let index = 0; index < raw.length; index += 1) raw[index] = (index * 7919) & 255;
  const small = pngBuffer();
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, sum]);
  };
  return Buffer.concat([small.subarray(0, 8), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
}

test.describe.configure({ mode: "serial" });

let page: Page;
const errors: string[] = [];
const toast = (text: string | RegExp) => page.getByRole("status").filter({ hasText: text });
const preview = () => page.getByRole("region", { name: "Live preview of your page" });
const saved = async () => {
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
};

test.beforeAll(async ({ browser }) => {
  mkdirSync(shots, { recursive: true });
  page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
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

test("profile picture: real image uploads, spoofed file is rejected", async () => {
  await page.getByRole("button", { name: /Edit profile/ }).click();
  await page.getByLabel("Upload profile picture").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  await expect(page.getByRole("alert").filter({ hasText: "does not match" })).toBeVisible();
  // Regression: real photos are over 1MB and used to fail silently.
  const big = largePng();
  expect(big.length).toBeGreaterThan(2 * 1024 * 1024);
  await page.getByLabel("Upload profile picture").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: big });
  await expect(toast("Profile picture updated")).toBeVisible();
  const src = await page.locator("dialog[open] img").first().getAttribute("src");
  expect(src).toMatch(/^\/uploads\/profile\/.+\.png$/);
  const served = await page.request.get(src!);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["content-security-policy"]).toContain("sandbox");
  expect((await page.request.get("/uploads/..%2f..%2fpackage.json")).status()).toBe(404);
  await page.screenshot({ path: `${shots}/profile-drawer.png` });
  await page.getByRole("button", { name: "Close" }).click();
});

test("social icons: detected from pasted links, reorderable, shown publicly", async () => {
  await page.getByRole("button", { name: "Add social icons" }).click();
  await page.getByLabel("Add a social profile").fill("https://bsky.app/profile/ada.bsky.social");
  await expect(page.getByText("Detected: Bluesky")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(toast("Bluesky added")).toBeVisible();
  await page.getByLabel("Add a social profile").fill("ada@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(toast("Email added")).toBeVisible();
  await page.getByRole("button", { name: "Move Email up" }).click();
  await saved();
  await page.getByRole("button", { name: "Close" }).click();
  const hrefs = await (await page.request.get("/")).text();
  expect(hrefs.indexOf('href="mailto:ada@example.com"')).toBeGreaterThan(-1);
});

test("block menu opens above the cards below it", async () => {
  await page.getByRole("button", { name: "More options for “Second link”" }).click();
  const item = page.getByRole("menuitem", { name: "Delete" });
  await item.scrollIntoViewIfNeeded();
  const box = (await item.boundingBox())!;
  const hit = await page.evaluate(([x, y]) => {
    const element = document.elementFromPoint(x, y);
    return element?.closest('[role="menu"]') ? "menu" : `${element?.tagName}.${String(element?.className).slice(0, 60)}`;
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit).toBe("menu");
  await page.keyboard.press("Escape");
});

test("thumbnail upload over 1MB from the details drawer", async () => {
  await page.getByRole("button", { name: "More options for “Second link”" }).click();
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  await page.getByLabel("Upload thumbnail").setInputFiles({ name: "thumb.png", mimeType: "image/png", buffer: largePng() });
  await expect(page.locator("dialog[open] img").first()).toHaveAttribute("src", /^\/uploads\/blocks\/.+\.png$/);
  await saved();
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page.locator(`li:has(input[aria-label="Link title"]) img`).first()).toHaveAttribute("src", /^\/uploads\/blocks\//);
});

test("thumbnail icon pack: pick an icon without uploading", async () => {
  await page.getByRole("button", { name: "More options for “First link”" }).click();
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  await page.getByRole("button", { name: "Choose icon" }).click();
  await page.getByPlaceholder("Search icons: shop, music, tickets…").fill("ticket");
  await page.getByRole("button", { name: "Tickets", exact: true }).click();
  await saved();
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  const html = await (await page.request.get("/")).text();
  // First link is hidden in the flow spec, so check the stored value via the editor card instead.
  expect(html).not.toContain("i:ticket");
  await expect(page.locator(`li:has(input[aria-label="Link title"])`).first().locator("svg.lucide-ticket")).toBeVisible();
});

test("block actions: details drawer, duplicate, delete with undo", async () => {
  await page.getByRole("button", { name: "More options for “Second link”" }).click();
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  await page.getByRole("radio", { name: /Featured/ }).click();
  await saved();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("li", { hasText: "Featured" }).first()).toBeVisible();

  await page.getByRole("button", { name: "More options for “Second link”" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(toast("Duplicated")).toBeVisible();
  await expect(page.getByLabel("Link title").filter({ hasText: "" })).toHaveCount(3);

  await page.getByRole("button", { name: "More options for “Second link (copy)”" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await toast("Deleted").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Link title")).toHaveCount(3);
  await page.getByRole("button", { name: "More options for “Second link (copy)”" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByLabel("Link title")).toHaveCount(2);
  await page.waitForTimeout(5600); // deletion commits after the undo window
  await page.reload();
  await expect(page.getByLabel("Link title")).toHaveCount(2);
});

test("add menu: heading, video embed, image and email signup", async () => {
  const add = () => page.getByRole("button", { name: "Add", exact: true }).click();
  await add();
  await page.getByPlaceholder("Search: YouTube, email, shop…").fill("heading");
  await page.getByRole("button", { name: /^Heading/ }).click();
  await page.getByLabel("Heading", { exact: true }).fill("Watch");
  await page.getByRole("button", { name: "Add heading" }).click();
  await expect(toast("Heading added")).toBeVisible();

  await add();
  await page.getByRole("button", { name: /^YouTube/ }).click();
  await page.getByLabel("YouTube link").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Add youtube" }).click();
  await expect(toast("Video added")).toBeVisible();
  await expect(preview().locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveAttribute("sandbox", /allow-scripts/);

  await add();
  await page.getByRole("button", { name: /^Image/ }).click();
  await page.getByLabel("Upload image").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: pngBuffer() });
  await expect(page.locator("dialog[open] img")).toBeVisible();
  await page.getByRole("button", { name: "Add image" }).click();
  await expect(toast("Image added")).toBeVisible();

  await add();
  await page.getByRole("button", { name: /^Email signup/ }).click();
  await page.getByRole("button", { name: "Add email signup" }).click();
  await expect(toast("Email signup form added")).toBeVisible();
  await page.screenshot({ path: `${shots}/editor.png` });

  const visitor = await page.context().browser()!.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/");
  await pub.getByPlaceholder("Email address").fill("fan@example.com");
  await pub.getByRole("button", { name: "Subscribe" }).click();
  await expect(pub.getByText("Thanks, you are subscribed.")).toBeVisible();
  await pub.setViewportSize({ width: 390, height: 844 });
  await pub.screenshot({ path: `${shots}/public-mobile.png`, fullPage: true });
  await visitor.close();
});

test("CSV import from the page tools menu", async () => {
  await page.getByRole("button", { name: "More page tools" }).click();
  await page.getByRole("menuitem", { name: "Import links (CSV)" }).click();
  await page.getByLabel("CSV file").setInputFiles({ name: "links.csv", mimeType: "text/csv", buffer: Buffer.from("title,url\nImported,https://imported.example.com\nBad,javascript:alert(1)\n") });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 link, skipped 1 invalid row" })).toBeVisible();
  expect(await (await page.request.get("/")).text()).not.toContain("Imported");
});

test("appearance: theme cards and customisation, live and autosaved", async () => {
  await page.getByRole("link", { name: "Appearance" }).first().click();
  await page.getByRole("button", { name: "Night Market" }).click();
  await expect(page.getByRole("button", { name: "Night Market" })).toHaveAttribute("aria-pressed", "true");
  await expect(preview().getByRole("region", { name: "Links" }).getByRole("link").first()).toHaveCSS("background-color", "rgb(255, 207, 90)");
  await page.getByRole("tab", { name: "Buttons" }).click();
  await page.getByRole("button", { name: "Outline" }).click();
  await expect(preview().getByRole("region", { name: "Links" }).getByRole("link").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await saved();
  await page.getByRole("tab", { name: "Theme" }).click();
  await expect(page.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
  // Presets stay untouched and the public page uses the custom theme.
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("transparent");
  await page.screenshot({ path: `${shots}/appearance.png` });
});

test("share: link, QR code and downloads", async () => {
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByLabel("Your link")).toHaveValue("http://localhost:3100/");
  await expect(page.getByRole("img", { name: /QR code for/ })).toBeVisible();
  const png = await page.request.get("/api/qr?format=png&download=1");
  expect(png.headers()["content-type"]).toBe("image/png");
  await page.getByRole("button", { name: "Close" }).click();
});

test("settings: short links", async () => {
  await page.goto("/admin/settings?tab=short-links");
  await page.getByLabel("Code").fill("tour");
  await page.getByLabel("Destination").fill("https://tour.example.com/");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("status").filter({ hasText: "/s/tour created" })).toBeVisible();
  const redirect = await page.request.get("/s/tour", { maxRedirects: 0 });
  expect(redirect.headers().location).toBe("https://tour.example.com/");
  await page.getByLabel("Code").first().fill("tour");
  await page.getByLabel("Destination").first().fill("https://other.example.com/");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already in use" })).toBeVisible();
});

test("settings: SEO saves without touching other tabs", async () => {
  await page.goto("/admin/settings?tab=page");
  await page.getByLabel("Footer text").fill("© Ada");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Page settings saved." })).toBeVisible();
  await page.goto("/admin/settings?tab=seo");
  await page.getByLabel("Page title").fill("Ada’s links");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Search & sharing settings saved." })).toBeVisible();
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("<title>Ada’s links</title>");
  expect(html).toContain("© Ada");
});

test("settings: two-factor authentication", async () => {
  const { totpCode } = await import("../lib/totp");
  await page.goto("/admin/settings?tab=security");
  await page.getByRole("button", { name: "Set up two-factor" }).click();
  const secret = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel("6-digit code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Two-factor authentication is enabled." })).toBeVisible();

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
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Two-factor authentication is disabled." })).toBeVisible();
});

test("settings: backup download and guarded restore", async () => {
  await page.goto("/admin/settings?tab=data");
  const backup = await (await page.request.get("/api/export?type=all")).json();
  expect(backup.format).toBe("belinked-backup");
  expect(JSON.stringify(backup)).not.toContain("passwordHash");
  await page.locator('input[name="backupFile"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("Type RESTORE to confirm").fill("RESTORE");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore backup" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Backup restored: \d+ blocks/ })).toBeVisible();
});

test("analytics renders with chart and table view", async () => {
  await page.goto("/admin/analytics?days=30");
  await expect(page.getByRole("img", { name: /Views and clicks per day/ })).toBeVisible();
  await page.getByRole("button", { name: "Show as table" }).click();
  await expect(page.getByRole("columnheader", { name: "Views" })).toBeVisible();
  await page.screenshot({ path: `${shots}/analytics.png`, fullPage: true });
});

test("no browser errors across the editor", async () => {
  expect(errors).toEqual([]);
});
