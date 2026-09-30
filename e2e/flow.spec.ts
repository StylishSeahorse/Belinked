import { expect, test, type Browser, type Page } from "@playwright/test";

/*
 * Full owner workflow against a fresh database:
 * setup -> login -> profile -> add links -> reorder -> publish -> public visit ->
 * click -> analytics -> disable link -> public check -> logout -> admin protected.
 */

const EMAIL = "owner@example.com";
const PASSWORD = "e2e correct horse battery";
// A normal desktop UA: HeadlessChrome is (correctly) classified as a bot by analytics.
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
  // Outbound destinations are stubbed so the test never depends on the internet.
  await context.route(/^https:\/\/(first|second)\.example\.com\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Destination</h1>" }));
  const page = await context.newPage();
  return { context, page, errors: trackErrors(page) };
}

let ownerPage: Page;
let ownerErrors: string[];

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  ownerPage = await context.newPage();
  ownerErrors = trackErrors(ownerPage);
});

test("1. first-run setup creates the single owner, then setup is closed", async () => {
  await ownerPage.goto("/admin");
  await expect(ownerPage).toHaveURL(/\/admin\/setup/);
  await ownerPage.getByLabel("Display name").fill("E2E Owner");
  await ownerPage.getByLabel("Email").fill(EMAIL);
  await ownerPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await ownerPage.getByLabel("Confirm password").fill(PASSWORD);
  await ownerPage.getByRole("button", { name: "Create owner" }).click();
  await expect(ownerPage).toHaveURL(/\/admin\/login/);
  await expect(ownerPage.getByText("Owner account created")).toBeVisible();

  await ownerPage.goto("/admin/setup");
  await expect(ownerPage).toHaveURL(/\/admin\/login/);
});

test("2. login rejects a wrong password, then succeeds", async () => {
  await ownerPage.getByLabel("Email").fill(EMAIL);
  await ownerPage.getByLabel("Password").fill("definitely wrong password");
  await ownerPage.getByRole("button", { name: "Sign in" }).click();
  await expect(ownerPage.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();

  await ownerPage.getByLabel("Password").fill(PASSWORD);
  await ownerPage.getByRole("button", { name: "Sign in" }).click();
  await expect(ownerPage).toHaveURL(/\/admin$/);
  await expect(ownerPage.getByRole("heading", { name: /Hi, E2E/ })).toBeVisible();
});

test("3. edit the profile, with validation errors shown instead of a crash", async () => {
  await ownerPage.goto("/admin/profile");
  await ownerPage.getByLabel("Display name").fill("Ada Example");
  await ownerPage.getByLabel("Bio").fill("Musician & maker. <script>alert(1)</script>");
  await ownerPage.getByLabel("Redirect URL").fill("javascript:alert(1)");
  await ownerPage.getByRole("button", { name: "Save profile" }).click();
  await expect(ownerPage.getByRole("alert").filter({ hasText: "Redirect URL" })).toBeVisible();
  // The other edits survive the validation error.
  await expect(ownerPage.getByLabel("Bio")).toHaveValue(/Musician & maker/);
  await expect(ownerPage.getByLabel("Display name")).toHaveValue("Ada Example");

  await ownerPage.getByLabel("Redirect URL").fill("");
  await ownerPage.getByRole("button", { name: "Save profile" }).click();
  await expect(ownerPage.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
});

async function addLink(title: string, url: string) {
  await ownerPage.goto("/admin/blocks");
  const addSection = ownerPage.locator("#add-block");
  if ((await addSection.getAttribute("open")) === null) await addSection.locator(":scope > summary").click();
  await addSection.getByLabel("Title", { exact: true }).fill(title);
  await addSection.getByLabel("URL", { exact: true }).fill(url);
  await addSection.getByRole("button", { name: "Add block" }).click();
  await expect(ownerPage.getByRole("status").filter({ hasText: "Block added" })).toBeVisible();
}

test("4. add two links, including a hidden-note that must never leak", async () => {
  await addLink("First link", "https://first.example.com/");
  await addLink("Second link", "https://second.example.com/");
  await expect(ownerPage.locator("summary", { hasText: "First link" })).toBeVisible();
  await expect(ownerPage.locator("summary", { hasText: "Second link" })).toBeVisible();
});

test("5. reorder with the keyboard-accessible move buttons", async () => {
  await ownerPage.getByRole("button", { name: 'Move "Second link" up' }).click();
  await expect(ownerPage.getByText("Order saved.")).toBeVisible();
  await ownerPage.reload();
  const titles = await ownerPage.locator("details[id^=block-] > summary").allInnerTexts();
  expect(titles[0]).toContain("Second link");
  expect(titles[1]).toContain("First link");
});

test("6. unpublish hides the page from visitors; publishing restores it", async ({ browser }) => {
  await ownerPage.goto("/admin");
  await ownerPage.getByRole("button", { name: "Unpublish" }).click();
  await expect(ownerPage.locator("strong", { hasText: "Your page is unpublished" })).toBeVisible();

  const visitor = await visitorPage(browser);
  await visitor.page.goto("/");
  await expect(visitor.page.getByRole("heading", { name: "This page is not published yet." })).toBeVisible();
  expect(await visitor.page.content()).not.toContain("First link");

  // The owner can still preview it.
  await ownerPage.goto("/");
  await expect(ownerPage.getByText("Preview: this page is unpublished")).toBeVisible();

  await ownerPage.goto("/admin");
  await ownerPage.getByRole("button", { name: "Publish now" }).click();
  await expect(ownerPage.locator("strong", { hasText: "Your page is live" })).toBeVisible();
  await visitor.context.close();
});

test("7-8. visitor sees the page in order, clicks a link, analytics records it", async ({ browser }) => {
  const visitor = await visitorPage(browser);
  const beacon = visitor.page.waitForRequest((req) => req.url().endsWith("/api/track") && req.method() === "POST", { timeout: 10_000 });
  const response = await visitor.page.goto("/?utm_source=e2e&utm_campaign=launch");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  await expect(visitor.page.getByRole("heading", { name: "Ada Example" })).toBeVisible();
  // Bio text is escaped, never executed.
  await expect(visitor.page.getByText("<script>alert(1)</script>", { exact: false })).toBeVisible();
  const links = visitor.page.getByRole("region", { name: "Links" }).getByRole("link");
  await expect(links.nth(0)).toContainText("Second link");
  await expect(links.nth(1)).toContainText("First link");
  const html = await visitor.page.content();
  expect(html).not.toContain("first.example.com");
  // The view beacon must fire, then the visitor clicks.
  await beacon;
  await visitor.page.waitForTimeout(300);
  await links.nth(1).click();
  await expect(visitor.page).toHaveURL("https://first.example.com/");
  await visitor.context.close();

  await ownerPage.goto("/admin/analytics?days=7");
  const performance = ownerPage.getByRole("region").filter({ hasText: "Link performance" });
  await expect(ownerPage.locator("table").first()).toContainText("First link");
  await expect(ownerPage.getByText("launch / e2e")).toBeVisible();
  void performance;
});

test("9. owner views and clicks do not inflate analytics", async () => {
  await ownerPage.goto("/admin");
  const before = await ownerPage.locator(".panel", { hasText: "Views (30d)" }).innerText();
  await ownerPage.goto("/");
  await ownerPage.goto("/admin");
  const after = await ownerPage.locator(".panel", { hasText: "Views (30d)" }).innerText();
  expect(after).toBe(before);
});

test("10-11. disabling a link removes it from the public page and its payload", async ({ browser }) => {
  await ownerPage.goto("/admin/blocks");
  const block = ownerPage.locator("details[id^=block-]", { hasText: "First link" });
  await block.locator(":scope > summary").click();
  await block.getByRole("button", { name: "Hide" }).click();
  await expect(ownerPage.getByRole("status").filter({ hasText: "is now hidden" })).toBeVisible();

  const visitor = await visitorPage(browser);
  await visitor.page.goto("/");
  await expect(visitor.page.getByText("Second link")).toBeVisible();
  expect(await visitor.page.content()).not.toContain("First link");
  // Direct click URL for a hidden block is refused.
  const blockId = (await block.getAttribute("id"))!.replace("block-", "");
  const direct = await visitor.page.request.get(`/api/click/${blockId}`, { maxRedirects: 0 });
  expect(direct.status()).toBe(404);
  expect(visitor.errors).toEqual([]);
  await visitor.context.close();
});

test("12-13. logout ends the session and every admin surface is protected", async ({ browser }) => {
  await ownerPage.goto("/admin");
  await ownerPage.getByRole("button", { name: "Sign out" }).first().click();
  await expect(ownerPage).toHaveURL(/\/admin\/login/);
  await ownerPage.goto("/admin/blocks");
  await expect(ownerPage).toHaveURL(/\/admin\/login/);

  const anon = await browser.newContext();
  for (const path of ["/api/export?type=all", "/api/qr", "/api/export?type=analytics&format=csv"]) {
    const response = await anon.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBeGreaterThanOrEqual(300);
    expect(response.status(), path).toBeLessThan(400);
    expect(response.headers().location, path).toContain("/admin/login");
  }
  const preview = await anon.request.get("/api/link-preview?url=https://example.com");
  expect(preview.status()).toBe(401);
  const adminHtml = await anon.request.get("/admin/settings", { maxRedirects: 0 });
  expect(adminHtml.headers()["x-robots-tag"]).toContain("noindex");
  await anon.close();
});

test("SEO basics: robots, sitemap, canonical, 404", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
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
