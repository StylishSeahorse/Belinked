import { expect, test, type Browser, type Page } from "@playwright/test";

/*
 * The core owner journey on a fresh database, through the visual editor:
 * setup -> editor -> profile -> add links -> reorder -> publish -> visitor ->
 * click -> analytics -> hide link -> logout -> admin protected.
 */

const EMAIL = "owner@example.com";
const PASSWORD = "e2e correct horse battery";
// HeadlessChrome is (correctly) classified as a bot, so visitors use a normal UA.
const VISITOR_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

test.describe.configure({ mode: "serial" });

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function visitorPage(browser: Browser) {
  const context = await browser.newContext({ userAgent: VISITOR_UA });
  await context.route(/^https:\/\/(first|second)\.example\.com\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Destination</h1>" }));
  const page = await context.newPage();
  return { context, page, errors: trackErrors(page) };
}

let owner: Page;
let ownerErrors: string[];

async function saved() {
  await expect(owner.getByText("Saving…")).toHaveCount(0, { timeout: 10_000 });
  await expect(owner.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function addLink(title: string, url: string) {
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = owner.locator("dialog[open]");
  await dialog.getByRole("button", { name: /^Link Any website/ }).click();
  await dialog.getByLabel("URL", { exact: true }).fill(url);
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(owner.getByRole("status").filter({ hasText: "Link added" }).first()).toBeVisible();
}

async function cardTitles() {
  return owner.getByLabel(/ title$/).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
}

test.beforeAll(async ({ browser }) => {
  owner = await (await browser.newContext()).newPage();
  ownerErrors = trackErrors(owner);
});

test("1. first-run setup signs the owner straight into the editor", async () => {
  await owner.goto("/admin");
  await expect(owner).toHaveURL(/\/admin\/setup/);
  await owner.getByLabel("Your name").fill("E2E Owner");
  await owner.getByLabel("Email").fill(EMAIL);
  await owner.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await owner.getByLabel("Confirm password").fill(PASSWORD);
  await owner.getByRole("button", { name: "Create my page" }).click();
  await expect(owner).toHaveURL(/\/admin$/);
  await expect(owner.getByRole("heading", { name: "Get your page ready" })).toBeVisible();
  await expect(owner.getByRole("heading", { name: "Your page is empty" })).toBeVisible();
  // The owner's name is already on the page, and the preview shows it.
  await expect(owner.getByRole("region", { name: "Live preview of your page" }).getByRole("heading", { name: "E2E Owner" })).toBeVisible();

  await owner.goto("/admin/setup");
  await expect(owner).not.toHaveURL(/\/admin\/setup/);
});

test("2. sign out from the account menu, then sign back in", async () => {
  await owner.goto("/admin");
  await owner.getByRole("button", { name: "Account menu" }).click();
  await owner.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(owner).toHaveURL(/\/admin\/login/);
  await owner.getByLabel("Email").fill(EMAIL);
  await owner.getByLabel("Password", { exact: true }).fill("definitely wrong password");
  await owner.getByRole("button", { name: "Sign in" }).click();
  await expect(owner.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  await owner.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await owner.getByRole("button", { name: "Sign in" }).click();
  await expect(owner).toHaveURL(/\/admin$/);
});

test("3. edit the profile in place; it autosaves and previews instantly", async () => {
  await owner.getByRole("button", { name: /Edit profile/ }).click();
  await owner.getByLabel("Display name").fill("Ada Example");
  await owner.getByLabel("Bio", { exact: true }).fill("Musician & maker. <script>alert(1)</script>");
  // Live preview updates before anything is saved.
  await expect(owner.getByRole("region", { name: "Live preview of your page" }).getByRole("heading", { name: "Ada Example" })).toBeVisible();
  await saved();
  await owner.getByRole("button", { name: "Close" }).click();
  await owner.reload();
  await expect(owner.getByRole("button", { name: /Edit profile/ })).toContainText("Ada Example");
});

test("4. add links from the Add menu; each appears immediately", async () => {
  await addLink("First link", "first.example.com/");
  await addLink("Second link", "https://second.example.com/");
  await expect.poll(cardTitles).toEqual(["First link", "Second link"]);
  // URL without a scheme was completed automatically.
  await expect(owner.getByLabel("Link URL").first()).toHaveValue("https://first.example.com/");
  await expect(owner.getByRole("region", { name: "Live preview of your page" }).getByText("Second link")).toBeVisible();
});

test("5. reorder with the keyboard and by dragging; the order persists", async () => {
  await owner.getByRole("button", { name: /^Reorder “Second link”/ }).focus();
  await owner.keyboard.press("ArrowUp");
  await saved();
  await expect.poll(cardTitles).toEqual(["Second link", "First link"]);

  // Drag "First link" back above "Second link" with the pointer.
  await owner.getByRole("button", { name: /^Reorder “First link”/ }).scrollIntoViewIfNeeded();
  await owner.evaluate(() => window.scrollBy(0, 120));
  const source = await owner.getByRole("button", { name: /^Reorder “First link”/ }).boundingBox();
  const target = await owner.getByRole("button", { name: /^Reorder “Second link”/ }).boundingBox();
  await owner.mouse.move(source!.x + 10, source!.y + 10);
  await owner.mouse.down();
  await owner.mouse.move(source!.x + 10, source!.y - 20, { steps: 4 });
  await owner.mouse.move(target!.x + 10, target!.y - 10, { steps: 10 });
  await owner.mouse.up();
  await saved();
  await expect.poll(cardTitles).toEqual(["First link", "Second link"]);

  await owner.reload();
  await expect.poll(cardTitles).toEqual(["First link", "Second link"]);
});

test("6. unpublish hides the page from visitors; publishing restores it", async ({ browser }) => {
  await owner.getByRole("button", { name: "Page is published" }).click();
  await owner.getByRole("menuitem", { name: "Unpublish page" }).click();
  await expect(owner.getByRole("button", { name: "Page is unpublished" })).toBeVisible();

  const visitor = await visitorPage(browser);
  await visitor.page.goto("/");
  await expect(visitor.page.getByRole("heading", { name: "This page is not published yet." })).toBeVisible();
  expect(await visitor.page.content()).not.toContain("First link");

  await owner.goto("/");
  await expect(owner.getByText("Preview: this page is unpublished")).toBeVisible();
  await owner.goto("/admin");
  await owner.getByRole("button", { name: "Page is unpublished" }).click();
  await owner.getByRole("menuitem", { name: "Publish page" }).click();
  await expect(owner.getByRole("status").filter({ hasText: "Your page is live" })).toBeVisible();
  await visitor.context.close();
});

test("7-8. a visitor sees the page, clicks a link, and analytics records it", async ({ browser }) => {
  const visitor = await visitorPage(browser);
  const beacon = visitor.page.waitForRequest((request) => request.url().endsWith("/api/track") && request.method() === "POST", { timeout: 10_000 });
  const response = await visitor.page.goto("/?utm_source=e2e&utm_campaign=launch");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  await expect(visitor.page.getByRole("heading", { name: "Ada Example" })).toBeVisible();
  await expect(visitor.page.getByText("<script>alert(1)</script>", { exact: false })).toBeVisible();
  const links = visitor.page.getByRole("region", { name: "Links" }).getByRole("link");
  await expect(links.nth(0)).toContainText("First link");
  expect(await visitor.page.content()).not.toContain("first.example.com");
  // Single-owner page: no @username handle is shown.
  await expect(visitor.page.getByText("@local-profile")).toHaveCount(0);
  await beacon;
  await visitor.page.waitForTimeout(300);
  await links.nth(0).click();
  await expect(visitor.page).toHaveURL("https://first.example.com/");
  await visitor.context.close();

  await owner.goto("/admin/analytics?days=7");
  await expect(owner.locator("section", { hasText: "Top links" }).getByRole("table")).toContainText("First link");
  await owner.getByText("More details").click();
  await expect(owner.getByText("launch / e2e")).toBeVisible();
});

test("9. the owner's own visits are not counted", async () => {
  await owner.goto("/admin/analytics?days=7");
  const before = await owner.locator(".panel", { hasText: "Views" }).first().innerText();
  await owner.goto("/");
  await owner.goto("/admin/analytics?days=7");
  expect(await owner.locator(".panel", { hasText: "Views" }).first().innerText()).toBe(before);
});

test("10-11. switching a link off hides it from the public page", async ({ browser }) => {
  await owner.goto("/admin");
  const blockId = await owner
    .getByLabel("Link title")
    .evaluateAll((inputs) => (inputs as HTMLInputElement[]).find((input) => input.value === "First link")!.closest("li")!.id.replace("block-", ""));
  const card = owner.locator(`#block-${blockId}`);
  await owner.getByRole("switch", { name: "Hide “First link”" }).click();
  await saved();
  await expect(card.getByText("Hidden")).toBeVisible();
  await expect(owner.getByRole("region", { name: "Live preview of your page" }).getByText("First link")).toHaveCount(0);

  const visitor = await visitorPage(browser);
  await visitor.page.goto("/");
  await expect(visitor.page.getByText("Second link")).toBeVisible();
  expect(await visitor.page.content()).not.toContain("First link");
  expect((await visitor.page.request.get(`/api/click/${blockId}`, { maxRedirects: 0 })).status()).toBe(404);
  expect(visitor.errors).toEqual([]);
  await visitor.context.close();
});

test("12-13. logout ends the session and every admin surface is protected", async ({ browser }) => {
  await owner.getByRole("button", { name: "Account menu" }).click();
  await owner.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(owner).toHaveURL(/\/admin\/login/);
  await owner.goto("/admin/appearance");
  await expect(owner).toHaveURL(/\/admin\/login/);

  const anon = await browser.newContext();
  for (const path of ["/api/export?type=all", "/api/qr", "/api/export?type=analytics&format=csv"]) {
    const response = await anon.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBeGreaterThanOrEqual(300);
    expect(response.status(), path).toBeLessThan(400);
    expect(response.headers().location, path).toContain("/admin/login");
  }
  expect((await anon.request.get("/api/link-preview?url=https://example.com")).status()).toBe(401);
  expect((await anon.request.get("/admin/settings", { maxRedirects: 0 })).headers()["x-robots-tag"]).toContain("noindex");
  await anon.close();
});

test("SEO basics: robots, sitemap, canonical, 404", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>http://localhost:3100/</loc>");
  const home = await (await request.get("/")).text();
  expect(home).toContain('rel="canonical"');
  expect(home).toContain('property="og:title"');
  expect(home).toContain("application/ld+json");
  expect((await request.get("/does-not-exist")).status()).toBe(404);
});

test("no browser errors in the owner session", async () => {
  // 400s come from link-preview lookups of the fake example.com URLs (no internet in tests).
  expect(ownerErrors.filter((error) => !error.includes("status of 400"))).toEqual([]);
});
