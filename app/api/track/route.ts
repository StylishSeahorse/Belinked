import { EventType } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/security";

const MAX_TRACK_BODY_BYTES = 10_000;

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TRACK_BODY_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const h = await headers();
  const ip = await requestIp();
  if (contentType.includes("application/json") || contentType.includes("text/plain")) {
    const text = await request.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Invalid tracking payload." }, { status: 400 });
    }
    await recordEvent({
      type: EventType.PROFILE_VIEW,
      profileId: cleanString(body.profileId, 80),
      path: cleanString(body.path, 300),
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip
    });
    return NextResponse.json({ ok: true });
  }

  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  if (email && isEmail(email)) {
    await prisma.subscriber.create({
      data: { email, source: String(form.get("subscriberBlockId") || "public-form").slice(0, 120), consent: true }
    });
    await recordEvent({
      type: EventType.SUBSCRIBER,
      blockId: String(form.get("subscriberBlockId") || "").slice(0, 80),
      referrer: h.get("referer"),
      userAgent: h.get("user-agent"),
      ip
    });
  } else if (email) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  return new Response("Subscribed. You can close this tab.", { status: 200 });
}
