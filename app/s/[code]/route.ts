import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";
import { assertSafeRedirect } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await prisma.shortLink.findUnique({ where: { code } });
  const now = new Date();
  if (!link || !link.isActive || (link.startsAt && link.startsAt > now) || (link.endsAt && link.endsAt < now)) {
    return new Response("Short link unavailable", { status: 404 });
  }
  const h = await headers();
  await recordEvent({
    type: EventType.SHORT_LINK_CLICK,
    shortCode: code,
    targetUrl: link.destination,
    referrer: h.get("referer"),
    userAgent: h.get("user-agent"),
    ip: await requestIp()
  });
  redirect(assertSafeRedirect(link.destination));
}
