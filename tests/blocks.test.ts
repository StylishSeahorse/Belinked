import { describe, expect, it } from "vitest";
import { addUtm, isBlockVisible } from "../lib/blocks";

describe("block visibility", () => {
  it("hides non-active blocks", () => {
    expect(isBlockVisible({ status: "HIDDEN", startsAt: null, endsAt: null })).toBe(false);
  });

  it("respects schedules", () => {
    const now = new Date("2026-05-26T00:00:00Z");
    expect(isBlockVisible({ status: "ACTIVE", startsAt: new Date("2026-05-27T00:00:00Z"), endsAt: null }, now)).toBe(false);
    expect(isBlockVisible({ status: "ACTIVE", startsAt: null, endsAt: new Date("2026-05-25T00:00:00Z") }, now)).toBe(false);
    expect(isBlockVisible({ status: "ACTIVE", startsAt: null, endsAt: null }, now)).toBe(true);
  });
});

describe("utm", () => {
  it("adds campaign parameters", () => {
    expect(addUtm("https://example.com/path", "bio", "profile", "launch")).toBe(
      "https://example.com/path?utm_source=bio&utm_medium=profile&utm_campaign=launch"
    );
  });
});
