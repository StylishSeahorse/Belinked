import { EventType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { summarizeEvents } from "../lib/analytics-summary";

describe("analytics summary", () => {
  it("calculates ctr and top links", () => {
    const now = new Date("2026-05-29T00:00:00Z");
    const summary = summarizeEvents([
      { type: EventType.PROFILE_VIEW, createdAt: now },
      { type: EventType.PROFILE_VIEW, createdAt: now },
      { type: EventType.LINK_CLICK, createdAt: now, block: { title: "Shop" } }
    ], { now });
    expect(summary.views).toBe(2);
    expect(summary.clicks).toBe(1);
    expect(summary.ctr).toBe(50);
    expect(summary.topLinks[0]).toMatchObject({ label: "Shop", count: 1, share: 100 });
  });

  it("builds trend and comparison data", () => {
    const now = new Date("2026-05-29T00:00:00Z");
    const summary = summarizeEvents([
      { type: EventType.PROFILE_VIEW, createdAt: new Date("2026-05-28T00:00:00Z"), referrer: "https://example.com/post", device: "mobile", browser: "Chrome", os: "iOS" },
      { type: EventType.LINK_CLICK, createdAt: new Date("2026-05-28T00:00:00Z"), block: { title: "Shop" }, referrer: "https://example.com/post", device: "mobile", browser: "Chrome", os: "iOS" },
      { type: EventType.PROFILE_VIEW, createdAt: new Date("2026-05-20T00:00:00Z") }
    ], { days: 7, now });

    expect(summary.views).toBe(1);
    expect(summary.previous.views).toBe(1);
    expect(summary.deltas.views).toBe(0);
    expect(summary.timeline).toHaveLength(7);
    expect(summary.topReferrers[0]).toMatchObject({ label: "example.com", count: 2 });
    expect(summary.devices[0]).toMatchObject({ label: "mobile", count: 2 });
  });
});

describe("analytics: visitors, campaigns and link performance", () => {
  it("counts unique visitors per day and per-link CTR", () => {
    const now = new Date("2026-05-29T12:00:00Z");
    const day = new Date("2026-05-29T08:00:00Z");
    const summary = summarizeEvents(
      [
        { type: EventType.PROFILE_VIEW, createdAt: day, ipHash: "v1", utmCampaign: "launch", utmSource: "ig" },
        { type: EventType.PROFILE_VIEW, createdAt: day, ipHash: "v1" },
        { type: EventType.PROFILE_VIEW, createdAt: day, ipHash: "v2", country: "AU" },
        { type: EventType.PROFILE_VIEW, createdAt: day, ipHash: "v3", country: "AU" },
        { type: EventType.LINK_CLICK, createdAt: day, ipHash: "v1", blockId: "b1", block: { title: "Shop" } },
        { type: EventType.LINK_CLICK, createdAt: day, ipHash: "v1", blockId: "b1", block: { title: "Shop" } }
      ],
      { days: 7, now }
    );
    expect(summary.views).toBe(4);
    expect(summary.visitors).toBe(3);
    expect(summary.linkPerformance[0]).toMatchObject({ key: "b1", clicks: 2, uniqueClickers: 1, ctr: 50 });
    expect(summary.countries[0]).toMatchObject({ label: "AU", count: 2 });
    expect(summary.campaigns[0].label).toBe("launch / ig");
  });
});
