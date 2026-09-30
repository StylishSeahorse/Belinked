import { EventType } from "@prisma/client";
import { UAParser } from "ua-parser-js";
import { prisma } from "./prisma";
import { looksLikeBot, visitorHash } from "./security";
import { summarizeEvents } from "./analytics-summary";

function clean(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Country only from headers set by a CDN/proxy (e.g. Cloudflare); no GeoIP lookups. */
export function countryFromHeaders(h: Pick<Headers, "get">) {
  const value = h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || h.get("x-country-code");
  return value && /^[A-Z]{2}$/i.test(value) && value.toUpperCase() !== "XX" ? value.toUpperCase() : undefined;
}

/** Keeps only the origin + path of a referrer; query strings can carry personal data. */
export function sanitizeReferrer(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:", "android-app:"].includes(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return undefined;
  }
}

export async function recordEvent(input: {
  type: EventType;
  profileId?: string;
  blockId?: string;
  shortCode?: string;
  path?: string;
  targetUrl?: string;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}) {
  const ua = new UAParser(input.userAgent || "").getResult();
  return prisma.event.create({
    data: {
      type: input.type,
      profileId: input.profileId,
      blockId: input.blockId,
      shortCode: input.shortCode,
      path: clean(input.path, 300),
      targetUrl: clean(input.targetUrl, 2048),
      referrer: sanitizeReferrer(input.referrer),
      browser: ua.browser.name,
      os: ua.os.name,
      device: ua.device.type || "desktop",
      country: input.country,
      utmSource: clean(input.utmSource, 80),
      utmMedium: clean(input.utmMedium, 80),
      utmCampaign: clean(input.utmCampaign, 80),
      // Daily-rotating anonymous id: supports unique-visitor counts without storing IPs.
      ipHash: visitorHash(input.ip || null, input.userAgent || null),
      isBot: looksLikeBot(input.userAgent || null)
    }
  });
}

export function rangeStart(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function analyticsSummary(days = 30) {
  const safeDays = Math.max(1, Math.min(days, 365));
  const now = new Date();
  // Current range plus an equal previous range for comparisons.
  const since = rangeStart(safeDays * 2, now);
  const events = await prisma.event.findMany({
    where: { createdAt: { gte: since }, isBot: false },
    select: {
      type: true,
      createdAt: true,
      blockId: true,
      shortCode: true,
      targetUrl: true,
      referrer: true,
      browser: true,
      os: true,
      device: true,
      country: true,
      ipHash: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      block: { select: { title: true, url: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  return summarizeEvents(events, { days: safeDays, now });
}
