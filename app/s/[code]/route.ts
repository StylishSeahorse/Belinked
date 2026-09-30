import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { countryFromHeaders, recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";
import { safeHref } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(code)) return new Response("Short link unavailable", { status: 404 });
  const link = await prisma.shortLink.findUnique({ where: { code } });
  const now = new Date();
  const target = safeHref(link?.destination);
  if (!link || !target || !link.isActive || (link.startsAt && link.startsAt > now) || (link.endsAt && link.endsAt < now)) {
    return new Response("Short link unavailable", { status: 404 });
  }
  const h = await headers();
  await recordEvent({
    type: EventType.SHORT_LINK_CLICK,
    shortCode: code,
    targetUrl: target,
    referrer: h.get("referer"),
    userAgent: h.get("user-agent"),
    ip: await requestIp(),
    country: countryFromHeaders(h)
  });
  redirect(target);
}
