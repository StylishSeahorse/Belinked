import { EventType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { summarizeEvents } from "../lib/analytics-summary";

describe("analytics summary", () => {
  it("calculates ctr and top links", () => {
    const summary = summarizeEvents([
      { type: EventType.PROFILE_VIEW, createdAt: new Date() },
      { type: EventType.PROFILE_VIEW, createdAt: new Date() },
      { type: EventType.LINK_CLICK, createdAt: new Date(), block: { title: "Shop" } }
    ]);
    expect(summary.views).toBe(2);
    expect(summary.clicks).toBe(1);
    expect(summary.ctr).toBe(50);
    expect(summary.topLinks[0]).toEqual(["Shop", 1]);
  });
});
