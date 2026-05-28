import type { EventType } from "@prisma/client";

export function summarizeEvents(events: Array<{ type: EventType; createdAt: Date; block?: { title: string } | null }>) {
  const views = events.filter((event) => event.type === "PROFILE_VIEW").length;
  const clicks = events.filter((event) => event.type === "LINK_CLICK" || event.type === "SHORT_LINK_CLICK").length;
  const byLink = new Map<string, number>();
  for (const event of events) {
    if ((event.type === "LINK_CLICK" || event.type === "SHORT_LINK_CLICK") && event.block?.title) {
      byLink.set(event.block.title, (byLink.get(event.block.title) || 0) + 1);
    }
  }
  return {
    views,
    clicks,
    ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0,
    topLinks: [...byLink.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}
