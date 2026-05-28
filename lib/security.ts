import crypto from "crypto";
import { headers } from "next/headers";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || "";
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
  return secret || "local-dev";
}

export function hashIp(ip: string | null) {
  return crypto.createHash("sha256").update(`${sessionSecret()}:${ip || "unknown"}`).digest("hex");
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
