import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { countryFromHeaders, recordEvent } from "@/lib/analytics";
import { currentOwner } from "@/lib/auth";
import { addUtm, isBlockVisible } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";
import { safeHref } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [block, profile] = await Promise.all([
    prisma.block.findUnique({ where: { id: id.slice(0, 64) } }),
    prisma.profile.findFirst({ select: { isPublished: true } })
  ]);
  if (!block || !block.url || !isBlockVisible(block)) return new Response("Link unavailable", { status: 404 });
  const owner = await currentOwner();
  if (!profile?.isPublished && !owner) return new Response("Link unavailable", { status: 404 });

  let target: string | undefined;
  try {
    target = safeHref(addUtm(block.url, block.utmSource, block.utmMedium, block.utmCampaign));
  } catch {
    target = undefined;
  }
  if (!target) return new Response("Link unavailable", { status: 404 });

  // The owner testing their own links should not inflate analytics.
  if (!owner) {
    const h = await headers();
    await recordEvent({
      type: EventType.LINK_CLICK,
      blockId: block.id,
      targetUrl: target,
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip: await requestIp(),
      country: countryFromHeaders(h)
    });
  }
  redirect(target);
}
