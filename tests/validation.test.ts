import { describe, expect, it } from "vitest";
import { assertSafeRedirect } from "../lib/validation";

describe("safe redirects", () => {
  it("allows web URLs", () => {
    expect(assertSafeRedirect("https://example.com")).toBe("https://example.com");
  });

  it("rejects javascript URLs", () => {
    expect(() => assertSafeRedirect("javascript:alert(1)")).toThrow();
  });
});
