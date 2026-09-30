import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "../lib/safe-fetch";
import { clientIpFromHeaders, looksLikeBot, visitorHash } from "../lib/security";
import { rateLimit, resetRateLimits } from "../lib/rate-limit";
import { userMessage, UserError } from "../lib/errors";
import { z } from "zod";

function h(values: Record<string, string>) {
  return new Headers(values);
}

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"])(
    "blocks private address %s",
    (address) => expect(isPrivateAddress(address)).toBe(true)
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => expect(isPrivateAddress(address)).toBe(false));

  it("rejects local and credentialed URLs before any request", () => {
    expect(() => assertPublicUrl("http://localhost:3000")).toThrow();
    expect(() => assertPublicUrl("http://[::1]/")).toThrow();
    expect(() => assertPublicUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertPublicUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublicUrl("https://user:pass@example.com")).toThrow();
    expect(() => assertPublicUrl("http://printer.local")).toThrow();
    expect(assertPublicUrl("https://example.com/page").hostname).toBe("example.com");
  });
});

describe("client IP handling", () => {
  it("does not trust a client-supplied X-Forwarded-For by default", () => {
    // Without a trusted proxy only the right-most hop is used, so rotating the left-most value changes nothing.
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }), {})).toBe("9.9.9.9");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "2.2.2.2, 9.9.9.9" }), {})).toBe("9.9.9.9");
  });

  it("uses the proxy-provided client IP when TRUST_PROXY is set", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }), { TRUST_PROXY: "true" })).toBe("1.1.1.1");
    expect(clientIpFromHeaders(h({ "x-real-ip": "3.3.3.3" }), { TRUST_PROXY: "true" })).toBe("3.3.3.3");
  });
});

describe("visitor hashing", () => {
  it("is stable within a day and changes across days", () => {
    const day1 = new Date("2026-01-01T10:00:00Z");
    const day1Later = new Date("2026-01-01T22:00:00Z");
    const day2 = new Date("2026-01-02T10:00:00Z");
    expect(visitorHash("1.2.3.4", "UA", day1)).toBe(visitorHash("1.2.3.4", "UA", day1Later));
    expect(visitorHash("1.2.3.4", "UA", day1)).not.toBe(visitorHash("1.2.3.4", "UA", day2));
    expect(visitorHash("1.2.3.4", "UA", day1)).not.toContain("1.2.3.4");
  });

  it("flags bots and missing user agents", () => {
    expect(looksLikeBot("Googlebot/2.1")).toBe(true);
    expect(looksLikeBot(null)).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit within a window, then resets", () => {
    resetRateLimits();
    const now = 1_000_000;
    expect([1, 2, 3].map(() => rateLimit("k", 2, 1000, now))).toEqual([true, true, false]);
    expect(rateLimit("k", 2, 1000, now + 1001)).toBe(true);
  });
});

describe("user-facing errors", () => {
  it("shows validation and user errors but hides internals", () => {
    const result = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    expect(userMessage(result.error)).toMatch(/^Title:/);
    expect(userMessage(new UserError("Nice message"))).toBe("Nice message");
    const original = console.error;
    console.error = () => undefined;
    expect(userMessage(new Error("SQLITE_CONSTRAINT at /app/lib/db.ts:12"))).toBe("Something went wrong. Please try again.");
    console.error = original;
  });
});
