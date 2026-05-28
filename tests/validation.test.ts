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
