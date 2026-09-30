import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { countryFromHeaders, recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, requestIp } from "@/lib/security";

const MAX_TRACK_BODY_BYTES = 4_000;

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function backToProfile(request: Request, query: string, blockId?: string) {
  const url = new URL(`/?${query}${blockId ? `#subscribe-${encodeURIComponent(blockId)}` : ""}`, request.url);
  // 303 so the browser follows with GET (standard post/redirect/get).
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TRACK_BODY_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const h = await headers();
  const ip = await requestIp();
  const ipKey = hashIp(ip);

  if (contentType.includes("application/json") || contentType.includes("text/plain")) {
    // A real visitor produces a handful of views per minute at most.
    if (!rateLimit(`view:${ipKey}`, 30, 60_000)) return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
    const text = (await request.text()).slice(0, MAX_TRACK_BODY_BYTES);
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Invalid tracking payload." }, { status: 400 });
    }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid tracking payload." }, { status: 400 });
    const profile = await prisma.profile.findFirst({ select: { id: true } });
    await recordEvent({
      type: EventType.PROFILE_VIEW,
      profileId: profile?.id,
      path: cleanString(body.path, 300),
      referrer: cleanString(body.referrer, 500),
      userAgent: h.get("user-agent"),
      ip,
      country: countryFromHeaders(h),
      utmSource: cleanString(body.utm_source, 80),
      utmMedium: cleanString(body.utm_medium, 80),
      utmCampaign: cleanString(body.utm_campaign, 80)
    });
    return NextResponse.json({ ok: true });
  }

  if (!contentType.includes("form")) return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });

  const form = await request.formData();
  const blockId = cleanString(form.get("subscriberBlockId"), 80);
  // Honeypot field: bots fill it, humans never see it. Pretend success.
  if (cleanString(form.get("website"))) return backToProfile(request, "subscribed=1", blockId);
  if (!rateLimit(`subscribe:${ipKey}`, 5, 10 * 60_000)) return backToProfile(request, "subscribe_error=rate", blockId);

  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!isEmail(email)) return backToProfile(request, "subscribe_error=invalid", blockId);

  const block = blockId ? await prisma.block.findFirst({ where: { id: blockId, type: "SUBSCRIBER_FORM", status: "ACTIVE" }, select: { id: true } }) : null;
  if (!block) return backToProfile(request, "subscribe_error=unavailable");

  const existing = await prisma.subscriber.findFirst({ where: { email }, select: { id: true } });
  if (!existing) {
    await prisma.subscriber.create({ data: { email, source: block.id, consent: true } });
    await recordEvent({
      type: EventType.SUBSCRIBER,
      blockId: block.id,
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip,
      country: countryFromHeaders(h)
    });
  }
  return backToProfile(request, "subscribed=1", block.id);
}
