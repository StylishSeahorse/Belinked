import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const h = await headers();
  const ip = await requestIp();
  if (contentType.includes("application/json") || contentType.includes("text/plain")) {
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};
    await recordEvent({
      type: EventType.PROFILE_VIEW,
      profileId: body.profileId,
      path: body.path,
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip
    });
    return NextResponse.json({ ok: true });
  }

  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  if (email) {
    await prisma.subscriber.create({
      data: { email, source: String(form.get("subscriberBlockId") || "public-form"), consent: true }
    });
    await recordEvent({
      type: EventType.SUBSCRIBER,
      blockId: String(form.get("subscriberBlockId") || ""),
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip
    });
  }
  return new Response("Subscribed. You can close this tab.", { status: 200 });
}
