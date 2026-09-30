import type { EventType } from "@prisma/client";

type AnalyticsEvent = {
  type: EventType;
  createdAt: Date;
  blockId?: string | null;
  country?: string | null;
  ipHash?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  block?: { title: string; url?: string | null } | null;
  shortCode?: string | null;
  targetUrl?: string | null;
  referrer?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
};

type CountItem = {
  label: string;
  count: number;
  share: number;
};

type DailyPoint = {
  date: string;
  label: string;
  views: number;
  visitors: number;
  clicks: number;
  subscribers: number;
};

export type LinkPerformance = {
  key: string;
  label: string;
  clicks: number;
  uniqueClickers: number;
  ctr: number;
};

function isClick(type: EventType) {
  return type === "LINK_CLICK" || type === "SHORT_LINK_CLICK";
}

function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function labelReferrer(value?: string | null) {
  if (!value) return "Direct / unknown";
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host || "Direct / unknown";
  } catch {
    return value.slice(0, 80);
  }
}

function pushCount(map: Map<string, number>, label?: string | null) {
  const key = label?.trim() || "Unknown";
  map.set(key, (map.get(key) || 0) + 1);
}

function ranked(map: Map<string, number>, total: number, limit = 8): CountItem[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, share: pct(count, total) }));
}

/**
 * Unique visitors = distinct (day, daily-rotating visitor hash) pairs. The hash salt
 * rotates daily by design, so a returning visitor counts once per day they visit.
 */
function uniqueVisitors(events: AnalyticsEvent[]) {
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type === "PROFILE_VIEW" && event.ipHash) seen.add(`${dayKey(event.createdAt)}:${event.ipHash}`);
  }
  return seen.size;
}

function totals(events: AnalyticsEvent[]) {
  const views = events.filter((event) => event.type === "PROFILE_VIEW").length;
  const clicks = events.filter((event) => isClick(event.type)).length;
  const subscribers = events.filter((event) => event.type === "SUBSCRIBER").length;
  const shortLinkClicks = events.filter((event) => event.type === "SHORT_LINK_CLICK").length;
  return {
    views,
    visitors: uniqueVisitors(events),
    clicks,
    subscribers,
    shortLinkClicks,
    ctr: pct(clicks, views)
  };
}

export function summarizeEvents(events: AnalyticsEvent[], options: { days?: number; now?: Date } = {}) {
  const days = Math.max(1, Math.min(options.days || 30, 365));
  const now = options.now || new Date();
  const currentStart = addDays(now, -days);
  const previousStart = addDays(currentStart, -days);
  const currentEvents = events.filter((event) => event.createdAt >= currentStart && event.createdAt <= now);
  const previousEvents = events.filter((event) => event.createdAt >= previousStart && event.createdAt < currentStart);
  const currentTotals = totals(currentEvents);
  const previousTotals = totals(previousEvents);

  const daily = new Map<string, DailyPoint>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const key = dayKey(addDays(now, -index));
    daily.set(key, { date: key, label: dayLabel(key), views: 0, visitors: 0, clicks: 0, subscribers: 0 });
  }

  const byLink = new Map<string, number>();
  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  const browsers = new Map<string, number>();
  const operatingSystems = new Map<string, number>();
  const countries = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const linkStats = new Map<string, { label: string; clicks: number; clickers: Set<string> }>();
  const dailyVisitors = new Map<string, Set<string>>();

  for (const event of currentEvents) {
    const point = daily.get(dayKey(event.createdAt));
    if (point) {
      if (event.type === "PROFILE_VIEW") {
        point.views += 1;
        if (event.ipHash) {
          const set = dailyVisitors.get(point.date) || new Set<string>();
          set.add(event.ipHash);
          dailyVisitors.set(point.date, set);
        }
      }
      if (isClick(event.type)) point.clicks += 1;
      if (event.type === "SUBSCRIBER") point.subscribers += 1;
    }

    if (isClick(event.type)) {
      const label = event.block?.title || (event.shortCode ? `Short link: ${event.shortCode}` : event.targetUrl) || "Unknown link";
      byLink.set(label, (byLink.get(label) || 0) + 1);
      const key = event.blockId || (event.shortCode ? `short:${event.shortCode}` : label);
      const stat = linkStats.get(key) || { label, clicks: 0, clickers: new Set<string>() };
      stat.clicks += 1;
      if (event.ipHash) stat.clickers.add(`${dayKey(event.createdAt)}:${event.ipHash}`);
      linkStats.set(key, stat);
    }
    if (event.type === "PROFILE_VIEW") {
      if (event.country) pushCount(countries, event.country);
      if (event.utmSource || event.utmMedium || event.utmCampaign) {
        pushCount(campaigns, [event.utmCampaign || "(no campaign)", event.utmSource, event.utmMedium].filter(Boolean).join(" / "));
      }
    }
    if (event.type === "PROFILE_VIEW" || isClick(event.type)) {
      pushCount(referrers, labelReferrer(event.referrer));
      pushCount(devices, event.device || "desktop");
      pushCount(browsers, event.browser);
      pushCount(operatingSystems, event.os);
    }
  }

  for (const [date, set] of dailyVisitors) {
    const point = daily.get(date);
    if (point) point.visitors = set.size;
  }
  const timeline = [...daily.values()];
  const linkPerformance: LinkPerformance[] = [...linkStats.entries()]
    .map(([key, stat]) => ({ key, label: stat.label, clicks: stat.clicks, uniqueClickers: stat.clickers.size, ctr: pct(stat.clicks, currentTotals.views) }))
    .sort((a, b) => b.clicks - a.clicks);
  const maxDaily = Math.max(1, ...timeline.flatMap((point) => [point.views, point.clicks, point.subscribers]));

  return {
    ...currentTotals,
    previous: previousTotals,
    deltas: {
      views: currentTotals.views - previousTotals.views,
      visitors: currentTotals.visitors - previousTotals.visitors,
      clicks: currentTotals.clicks - previousTotals.clicks,
      subscribers: currentTotals.subscribers - previousTotals.subscribers,
      ctr: Math.round((currentTotals.ctr - previousTotals.ctr) * 10) / 10
    },
    timeline,
    maxDaily,
    topLinks: ranked(byLink, currentTotals.clicks, 10),
    topReferrers: ranked(referrers, currentEvents.length, 8),
    devices: ranked(devices, currentEvents.length, 6),
    browsers: ranked(browsers, currentEvents.length, 6),
    operatingSystems: ranked(operatingSystems, currentEvents.length, 6),
    countries: ranked(countries, currentTotals.views, 10),
    campaigns: ranked(campaigns, currentTotals.views, 10),
    linkPerformance
  };
}
