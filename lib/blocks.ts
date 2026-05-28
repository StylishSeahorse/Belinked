import type { Block } from "@prisma/client";

export function isBlockVisible(block: Pick<Block, "status" | "startsAt" | "endsAt">, at = new Date()) {
  if (block.status !== "ACTIVE") return false;
  if (block.startsAt && block.startsAt > at) return false;
  if (block.endsAt && block.endsAt < at) return false;
  return true;
}

export function addUtm(url: string, source?: string | null, medium?: string | null, campaign?: string | null) {
  if (!source && !medium && !campaign) return url;
  const parsed = new URL(url);
  if (source) parsed.searchParams.set("utm_source", source);
  if (medium) parsed.searchParams.set("utm_medium", medium);
  if (campaign) parsed.searchParams.set("utm_campaign", campaign);
  return parsed.toString();
}
