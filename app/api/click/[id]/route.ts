import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordEvent } from "@/lib/analytics";
import { addUtm, isBlockVisible } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";
import { assertSafeRedirect } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const block = await prisma.block.findUnique({ where: { id } });
  if (!block || !block.url || !isBlockVisible(block)) return new Response("Link unavailable", { status: 404 });
  const target = addUtm(block.url, block.utmSource, block.utmMedium, block.utmCampaign);
  const h = await headers();
  await recordEvent({
    type: EventType.LINK_CLICK,
    blockId: block.id,
    targetUrl: target,
    referrer: h.get("referer"),
    userAgent: h.get("user-agent"),
    ip: await requestIp()
  });
  redirect(assertSafeRedirect(target));
}
