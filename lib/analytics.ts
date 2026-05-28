import { EventType } from "@prisma/client";
import { UAParser } from "ua-parser-js";
import { prisma } from "./prisma";
import { hashIp, looksLikeBot } from "./security";
import { summarizeEvents } from "./analytics-summary";

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
}) {
  const parser = new UAParser(input.userAgent || "");
  const ua = parser.getResult();
  return prisma.event.create({
    data: {
      type: input.type,
      profileId: input.profileId,
      blockId: input.blockId,
      shortCode: input.shortCode,
      path: input.path,
      targetUrl: input.targetUrl,
      referrer: input.referrer || undefined,
      browser: ua.browser.name,
      os: ua.os.name,
      device: ua.device.type || "desktop",
      ipHash: hashIp(input.ip || null),
      isBot: looksLikeBot(input.userAgent || null)
    }
  });
}

export async function analyticsSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { createdAt: { gte: since }, isBot: false },
    include: { block: true },
    orderBy: { createdAt: "asc" }
  });
  return summarizeEvents(events);
}
