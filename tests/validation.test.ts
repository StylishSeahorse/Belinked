import { describe, expect, it } from "vitest";
import { assertSafeRedirect, assertSafeWebUrl, safeHref } from "../lib/validation";

describe("safe redirects", () => {
  it("allows web URLs", () => {
    expect(assertSafeRedirect("https://example.com")).toBe("https://example.com");
  });

  it("rejects javascript URLs", () => {
    expect(() => assertSafeRedirect("javascript:alert(1)")).toThrow();
  });

  it("keeps metadata hrefs safe", () => {
    expect(safeHref("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });

  it("can require web-only URLs", () => {
    expect(assertSafeWebUrl("https://example.com")).toBe("https://example.com");
    expect(() => assertSafeWebUrl("mailto:test@example.com")).toThrow();
  });
});

import { blockSchema, metadataJson, optionalDate } from "../lib/validation";

describe("block validation", () => {
  const base = { type: "LINK", title: "Hi", featured: false, status: "ACTIVE" };

  it("rejects invalid dates and end-before-start", () => {
    expect(optionalDate.safeParse("not a date").success).toBe(false);
    expect(optionalDate.parse("")).toBeUndefined();
    const result = blockSchema.safeParse({ ...base, startsAt: "2026-02-01T00:00:00Z", endsAt: "2026-01-01T00:00:00Z" });
    expect(result.success).toBe(false);
  });

  it("requires metadata to be a JSON object", () => {
    expect(metadataJson.safeParse("[1,2]").success).toBe(false);
    expect(metadataJson.safeParse("{oops").success).toBe(false);
    expect(metadataJson.parse(' { "buttonLabel": "Go" } ')).toBe('{"buttonLabel":"Go"}');
    expect(metadataJson.parse(undefined)).toBe("{}");
  });

  it("rejects dangerous link URLs", () => {
    expect(blockSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, url: "data:text/html,hi" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, url: "https://example.com" }).success).toBe(true);
  });
});
