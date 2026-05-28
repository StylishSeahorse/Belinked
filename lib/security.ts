import crypto from "crypto";
import { headers } from "next/headers";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashIp(ip: string | null) {
  const salt = process.env.SESSION_SECRET || "local-dev";
  return crypto.createHash("sha256").update(`${salt}:${ip || "unknown"}`).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function requestIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export function looksLikeBot(userAgent: string | null) {
  if (!userAgent) return false;
  return /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|whatsapp/i.test(userAgent);
}
