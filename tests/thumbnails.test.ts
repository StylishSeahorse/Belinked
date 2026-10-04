import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Auto-thumbnails against a real throwaway database. Outbound HTTP (safeFetch) is
 * faked so the tests never touch the internet; everything else is real.
 */

const dir = mkdtempSync(path.join(os.tmpdir(), "belinked-thumbs-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.SESSION_SECRET = "thumbnail-test-secret-thumbnail-test-secret";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name)
  }),
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.5" })
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

type Page = { html?: string; image?: Buffer; type?: string; status?: number };
const web = new Map<string, Page>();
vi.mock("../lib/safe-fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/safe-fetch")>();
  return {
    ...original,
    safeFetch: async (url: string) => {
      const page = web.get(url);
      if (!page) throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
      const bytes = page.image ?? Buffer.from(page.html ?? "");
      return { status: page.status ?? 200, url, headers: { "content-type": page.type ?? (page.image ? "image/png" : "text/html") }, body: bytes.toString("utf8"), bytes, truncated: false };
    }
  };
});

function png(width = 4, height = 3) {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk("IEND", Buffer.alloc(0))]);
}

let prisma: typeof import("../lib/prisma").prisma;
let actions: typeof import("../app/editor-actions");
const written: string[] = [];

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "ignore" });
  prisma = (await import("../lib/prisma")).prisma;
  actions = await import("../app/editor-actions");
  const auth = await import("../lib/auth");
  await prisma.profile.create({ data: { slug: "me", displayName: "Owner", username: "x", bio: "" } });
  await auth.createOwner("owner@example.com", "correct horse battery", "Owner");
  await auth.login("owner@example.com", "correct horse battery");
}, 60_000);

afterAll(async () => {
  for (const file of written) {
    try {
      unlinkSync(path.join(process.cwd(), "public", file));
    } catch {
      // already gone
    }
  }
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => web.clear());

async function link(url: string, extra: Record<string, unknown> = {}) {
  return prisma.block.create({ data: { type: "LINK", title: "Link", url, position: 1, ...extra } });
}

async function run(id: string, mode?: "auto" | "missing" | "refresh") {
  const result = await actions.autoThumbnail(id, mode);
  if (result.ok && result.data.found && result.data.block.imageUrl) written.push(result.data.block.imageUrl);
  return result;
}

describe("auto thumbnails", () => {
  it("copies the page's og:image into local uploads", async () => {
    web.set("https://site.example/a", { html: '<meta property="og:image" content="/cover.png">' });
    web.set("https://site.example/cover.png", { image: png() });
    const block = await link("https://site.example/a");
    const result = await run(block.id);
    expect(result.ok && result.data.found).toBe(true);
    const saved = await prisma.block.findUniqueOrThrow({ where: { id: block.id } });
    expect(saved.imageUrl).toMatch(/^\/uploads\/blocks\/.+\.png$/);
    expect(JSON.parse(saved.metadata)).toMatchObject({ autoThumbnail: true, thumbnailSource: "https://site.example/a" });
  });

  it("falls back to the site's icon when there is no preview image", async () => {
    web.set("https://icon.example/", { html: '<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">' });
    web.set("https://icon.example/apple.png", { image: png() });
    const block = await link("https://icon.example/");
    expect((await run(block.id)).ok).toBe(true);
    expect((await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toMatch(/^\/uploads\/blocks\//);
  });

  it("never replaces an image the owner uploaded", async () => {
    web.set("https://site.example/b", { html: '<meta property="og:image" content="https://site.example/cover.png">' });
    web.set("https://site.example/cover.png", { image: png() });
    const block = await link("https://site.example/b", { imageUrl: "/uploads/blocks/mine.png" });
    await run(block.id, "auto");
    await run(block.id, "missing");
    expect((await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toBe("/uploads/blocks/mine.png");
  });

  it("respects a removed thumbnail unless explicitly refreshed", async () => {
    web.set("https://site.example/c", { html: '<meta property="og:image" content="https://site.example/cover.png">' });
    web.set("https://site.example/cover.png", { image: png() });
    const block = await link("https://site.example/c", { metadata: JSON.stringify({ autoThumbnail: "off" }) });
    await run(block.id, "auto");
    expect((await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toBeNull();
    const refreshed = await run(block.id, "refresh");
    expect(refreshed.ok && refreshed.data.found).toBe(true);
  });

  it("rejects non-images and SVG, and reports failures only on refresh", async () => {
    web.set("https://bad.example/", { html: '<meta property="og:image" content="https://bad.example/x.svg">' });
    web.set("https://bad.example/x.svg", { html: "<svg onload=alert(1)>", type: "image/svg+xml" });
    const block = await link("https://bad.example/");
    const auto = await run(block.id, "auto");
    expect(auto.ok && auto.data.found).toBe(false);
    const refreshed = await run(block.id, "refresh");
    expect(refreshed.ok).toBe(false);
    expect((await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toBeNull();
  });

  it("doesn't retry the same URL automatically, but does after a URL change", async () => {
    const block = await link("https://slow.example/");
    await run(block.id, "auto"); // page unreachable
    web.set("https://slow.example/", { html: '<meta property="og:image" content="https://slow.example/i.png">' });
    web.set("https://slow.example/i.png", { image: png() });
    expect((await run(block.id, "auto")).ok && (await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toBeFalsy();
    await prisma.block.update({ where: { id: block.id }, data: { url: "https://slow.example/?v=2" } });
    web.set("https://slow.example/?v=2", { html: '<meta property="og:image" content="https://slow.example/i.png">' });
    expect((await run(block.id, "auto")).ok).toBe(true);
    expect((await prisma.block.findUniqueOrThrow({ where: { id: block.id } })).imageUrl).toMatch(/^\/uploads\/blocks\//);
  });

  it("a concurrent title edit does not wipe a freshly fetched thumbnail", async () => {
    web.set("https://race.example/", { html: '<meta property="og:image" content="https://race.example/i.png">' });
    web.set("https://race.example/i.png", { image: png() });
    const block = await link("https://race.example/");
    await run(block.id);
    // The editor only sends the changed field; imageUrl must survive.
    expect((await actions.updateBlock(block.id, { title: "Renamed" })).ok).toBe(true);
    const saved = await prisma.block.findUniqueOrThrow({ where: { id: block.id } });
    expect(saved.title).toBe("Renamed");
    expect(saved.imageUrl).toMatch(/^\/uploads\/blocks\//);
  });
});
