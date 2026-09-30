import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Integration tests against a real, throwaway SQLite database. Only Next's request
 * accessors (cookies/headers) are replaced with in-memory fakes.
 */

const dir = mkdtempSync(path.join(os.tmpdir(), "belinked-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.SESSION_SECRET = "integration-test-secret-integration-test";

const cookieJar = new Map<string, string>();
const requestHeaders = new Map<string, string>([["user-agent", "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"]]);

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name)
  }),
  headers: async () => new Headers(Object.fromEntries(requestHeaders))
}));

type Modules = {
  prisma: typeof import("../lib/prisma").prisma;
  auth: typeof import("../lib/auth");
  backup: typeof import("../lib/backup");
  csv: typeof import("../lib/csv");
  totp: typeof import("../lib/totp");
  track: typeof import("../app/api/track/route");
  rate: typeof import("../lib/rate-limit");
};
let m: Modules;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "ignore" });
  m = {
    prisma: (await import("../lib/prisma")).prisma,
    auth: await import("../lib/auth"),
    backup: await import("../lib/backup"),
    csv: await import("../lib/csv"),
    totp: await import("../lib/totp"),
    track: await import("../app/api/track/route"),
    rate: await import("../lib/rate-limit")
  };
  await m.prisma.profile.create({ data: { slug: "me", displayName: "Test Owner", username: "tester", bio: "Hello" } });
  await m.auth.createOwner("Owner@Example.com", "correct horse battery", "Test Owner");
}, 60_000);

afterAll(async () => {
  await m?.prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  cookieJar.clear();
  requestHeaders.set("x-forwarded-for", "203.0.113.10");
  await m.prisma.loginAttempt.deleteMany();
  m.rate.resetRateLimits();
});

describe("owner authentication", () => {
  it("refuses a second owner", async () => {
    await expect(m.auth.createOwner("other@example.com", "another long password", "Other")).rejects.toThrow(/already exists/);
  });

  it("logs in case-insensitively and creates a session", async () => {
    expect(await m.auth.login("OWNER@example.com", "correct horse battery")).toEqual({ ok: true });
    expect(cookieJar.get("belinked_session")).toBeTruthy();
    expect((await m.auth.currentOwner())?.email).toBe("owner@example.com");
    await m.auth.logout();
    expect(await m.auth.currentOwner()).toBeNull();
  });

  it("rejects wrong passwords and locks out after repeated failures", async () => {
    for (let attempt = 0; attempt < m.auth.MAX_FAILURES_PER_IP; attempt += 1) {
      expect((await m.auth.login("owner@example.com", "wrong password!!")).ok).toBe(false);
    }
    const locked = await m.auth.login("owner@example.com", "correct horse battery");
    expect(locked).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });

  it("cannot bypass the lockout by rotating a spoofed X-Forwarded-For prefix", async () => {
    for (let attempt = 0; attempt < m.auth.MAX_FAILURES_PER_IP; attempt += 1) {
      requestHeaders.set("x-forwarded-for", `10.0.0.${attempt}, 203.0.113.10`);
      await m.auth.login("owner@example.com", "wrong password!!");
    }
    requestHeaders.set("x-forwarded-for", "10.9.9.9, 203.0.113.10");
    expect((await m.auth.login("owner@example.com", "correct horse battery")).ok).toBe(false);
  });

  it("enforces the global failure cap across many IPs", async () => {
    await m.prisma.loginAttempt.createMany({
      data: Array.from({ length: m.auth.MAX_FAILURES_GLOBAL }, (_, index) => ({ email: "x@example.com", ipHash: `ip-${index}`, success: false }))
    });
    requestHeaders.set("x-forwarded-for", "198.51.100.77");
    expect((await m.auth.login("owner@example.com", "correct horse battery")).ok).toBe(false);
  });

  it("requires a valid TOTP code when 2FA is enabled", async () => {
    const owner = await m.prisma.owner.findFirstOrThrow();
    const secret = m.totp.generateTotpSecret();
    await m.prisma.owner.update({ where: { id: owner.id }, data: { totpSecret: secret, totpEnabled: true } });
    expect(await m.auth.login("owner@example.com", "correct horse battery")).toMatchObject({ ok: false, needsTotp: true });
    expect(await m.auth.login("owner@example.com", "correct horse battery", "000000")).toMatchObject({ ok: false });
    expect(await m.auth.login("owner@example.com", "correct horse battery", m.totp.totpCode(secret))).toEqual({ ok: true });
    await m.prisma.owner.update({ where: { id: owner.id }, data: { totpSecret: null, totpEnabled: false } });
  });

  it("changes the password only with the current password and revokes other sessions", async () => {
    await m.auth.login("owner@example.com", "correct horse battery");
    const owner = await m.prisma.owner.findFirstOrThrow();
    await m.prisma.session.create({ data: { ownerId: owner.id, tokenHash: "other-device", expiresAt: new Date(Date.now() + 86_400_000) } });
    await expect(m.auth.changeOwnerPassword(owner.id, "not my password", "brand new password")).rejects.toThrow(/incorrect/);
    await m.auth.changeOwnerPassword(owner.id, "correct horse battery", "brand new password");
    expect(await m.prisma.session.findUnique({ where: { tokenHash: "other-device" } })).toBeNull();
    expect(await m.auth.currentOwner()).not.toBeNull();
    await m.auth.changeOwnerPassword(owner.id, "brand new password", "correct horse battery");
  });
});

describe("backup and restore", () => {
  it("round-trips content, redacts secrets, and keeps existing secrets on restore", async () => {
    await m.prisma.block.createMany({
      data: [
        { type: "LINK", title: "Shop", url: "https://shop.example.com", position: 1, internalNote: "note" },
        { type: "HEADER", title: "Music", position: 2 }
      ]
    });
    await m.prisma.socialIcon.create({ data: { label: "Instagram", icon: "instagram", url: "https://instagram.com/me", position: 1 } });
    await m.prisma.appSetting.upsert({ where: { key: "platform" }, update: { value: JSON.stringify({ smtp: { host: "mail", password: "hunter2" } }) }, create: { key: "platform", value: JSON.stringify({ smtp: { host: "mail", password: "hunter2" } }) } });

    const backup = await m.backup.buildBackup();
    expect(JSON.stringify(backup)).not.toContain("hunter2");
    expect(JSON.stringify(backup)).not.toContain("passwordHash");

    await m.prisma.block.deleteMany();
    await m.prisma.block.create({ data: { type: "LINK", title: "Temporary", url: "https://tmp.example.com", position: 1 } });
    const summary = await m.backup.restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect(summary.blocks).toBe(2);
    const blocks = await m.prisma.block.findMany({ orderBy: { position: "asc" } });
    expect(blocks.map((block) => block.title)).toEqual(["Shop", "Music"]);
    expect(blocks.map((block) => block.position)).toEqual([1, 2]);
    const settings = JSON.parse((await m.prisma.appSetting.findUniqueOrThrow({ where: { key: "platform" } })).value);
    expect(settings.smtp.password).toBe("hunter2");
  });

  it("rejects non-backups without touching data", async () => {
    const before = await m.prisma.block.count();
    await expect(m.backup.restoreBackup({ hello: "world" })).rejects.toThrow(/not a Belinked backup/);
    expect(await m.prisma.block.count()).toBe(before);
  });

  it("drops unsafe URLs from restored blocks", async () => {
    await m.backup.restoreBackup({ format: "belinked-backup", version: 1, blocks: [{ type: "LINK", title: "Bad", url: "javascript:alert(1)", imageUrl: "javascript:x" }] });
    const [block] = await m.prisma.block.findMany();
    expect(block.url).toBeNull();
    expect(block.imageUrl).toBeNull();
  });
});

describe("CSV import", () => {
  it("imports valid links as hidden and skips invalid rows", async () => {
    await m.prisma.block.deleteMany();
    const result = await m.csv.importLinksFromCsv("title,url,description\nSite,https://a.example.com,Desc\nBad,javascript:alert(1),\n,https://b.example.com,\n");
    expect(result).toEqual({ created: 1, skipped: 2 });
    const [block] = await m.prisma.block.findMany();
    expect(block).toMatchObject({ title: "Site", status: "HIDDEN", position: 1 });
  });
});

describe("subscribe endpoint", () => {
  async function subscribe(fields: Record<string, string>) {
    const body = new URLSearchParams(fields);
    return m.track.POST(new Request("http://localhost/api/track", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }));
  }

  it("stores a subscriber once, ignores honeypot bots, and validates the form block", async () => {
    await m.prisma.subscriber.deleteMany();
    const form = await m.prisma.block.create({ data: { type: "SUBSCRIBER_FORM", title: "Join", position: 99 } });
    const ok = await subscribe({ email: "Fan@Example.com", subscriberBlockId: form.id });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toContain("subscribed=1");
    await subscribe({ email: "fan@example.com", subscriberBlockId: form.id });
    await subscribe({ email: "bot@example.com", subscriberBlockId: form.id, website: "spam" });
    expect((await m.prisma.subscriber.findMany()).map((subscriber) => subscriber.email)).toEqual(["fan@example.com"]);

    const invalid = await subscribe({ email: "not-an-email", subscriberBlockId: form.id });
    expect(invalid.headers.get("location")).toContain("subscribe_error=invalid");
    const wrongBlock = await subscribe({ email: "x@example.com", subscriberBlockId: "nope" });
    expect(wrongBlock.headers.get("location")).toContain("subscribe_error=unavailable");
  });

  it("records page views with anonymous visitor hashes and UTM data", async () => {
    await m.prisma.event.deleteMany();
    const response = await m.track.POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        body: JSON.stringify({ path: "/", referrer: "https://www.instagram.com/some/post?secret=1", utm_campaign: "launch" }),
        headers: { "content-type": "text/plain" }
      })
    );
    expect(response.status).toBe(200);
    const [event] = await m.prisma.event.findMany();
    expect(event).toMatchObject({ type: "PROFILE_VIEW", utmCampaign: "launch", referrer: "https://www.instagram.com/some/post" });
    expect(event.ipHash).not.toContain("203.0.113.10");
  });
});
