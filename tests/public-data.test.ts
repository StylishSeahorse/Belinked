import type { Block, SocialIcon } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { publicBlocks, publicSocials } from "../lib/public-data";

function block(overrides: Partial<Block>): Block {
  return {
    id: "b1",
    type: "LINK",
    status: "ACTIVE",
    title: "Title",
    description: null,
    url: "https://example.com",
    imageUrl: null,
    icon: null,
    tags: "secret-tag",
    internalNote: "private note",
    featured: false,
    animation: null,
    utmSource: "src",
    utmMedium: null,
    utmCampaign: null,
    startsAt: null,
    endsAt: null,
    position: 1,
    metadata: "{}",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("public block mapping", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("drops hidden, archived, scheduled and expired blocks", () => {
    const result = publicBlocks(
      [
        block({ id: "visible" }),
        block({ id: "hidden", status: "HIDDEN" }),
        block({ id: "archived", status: "ARCHIVED" }),
        block({ id: "future", startsAt: new Date("2026-07-01") }),
        block({ id: "expired", endsAt: new Date("2026-05-01") })
      ],
      now
    );
    expect(result.map((item) => item.id)).toEqual(["visible"]);
  });

  it("never exposes private fields or raw destination URLs", () => {
    const [item] = publicBlocks([block({ url: "https://secret-destination.example.com/?token=abc" })], now);
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("private note");
    expect(serialized).not.toContain("secret-tag");
    expect(serialized).not.toContain("secret-destination");
    expect(item.href).toBe("/api/click/b1");
  });

  it("drops unsafe media and embed URLs", () => {
    const [item] = publicBlocks([block({ type: "EMBED", url: "https://evil.example.com/frame", imageUrl: "javascript:alert(1)" })], now);
    expect(item.embed).toBeNull();
    expect(item.imageUrl).toBeNull();
  });

  it("filters invisible or unsafe socials", () => {
    const social = (overrides: Partial<SocialIcon>): SocialIcon => ({ id: "s", label: "X", url: "https://x.com/me", icon: "x", position: 1, isVisible: true, createdAt: new Date(), updatedAt: new Date(), ...overrides });
    const result = publicSocials([social({ id: "ok" }), social({ id: "hidden", isVisible: false }), social({ id: "js", url: "javascript:alert(1)" })]);
    expect(result.map((item) => item.id)).toEqual(["ok"]);
  });
});
