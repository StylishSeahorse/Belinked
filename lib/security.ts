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

/** Stable keyed hash of an IP, used only for login throttling. */
export function hashIp(ip: string | null) {
  return crypto.createHmac("sha256", sessionSecret()).update(ip || "unknown").digest("hex");
}

/**
 * Anonymous visitor id for analytics. The salt rotates daily, so the same visitor
 * cannot be linked across days and no raw IP is ever stored.
 */
export function visitorHash(ip: string | null, userAgent: string | null, at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  return crypto
    .createHmac("sha256", `${sessionSecret()}:visitor:${day}`)
    .update(`${ip || "unknown"}|${userAgent || ""}`)
    .digest("hex")
    .slice(0, 32);
}

export function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function trustProxy(env: Record<string, string | undefined> = process.env) {
  return ["1", "true", "yes", "on"].includes((env.TRUST_PROXY || "").trim().toLowerCase());
}

/**
 * Client IP from proxy headers. X-Forwarded-For is client-controlled unless a trusted
 * reverse proxy overwrites it. With TRUST_PROXY=true the proxy-provided X-Real-IP or the
 * left-most X-Forwarded-For entry is used; otherwise only the right-most entry (the
 * one appended by the nearest hop) is used, so a client cannot rotate it freely.
 */
export function clientIpFromHeaders(h: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env) {
  const forwarded = (h.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (trustProxy(env)) return h.get("x-real-ip")?.trim() || forwarded[0] || "local";
  return forwarded[forwarded.length - 1] || h.get("x-real-ip")?.trim() || "local";
}

export async function requestIp() {
  return clientIpFromHeaders(await headers());
}

export function looksLikeBot(userAgent: string | null) {
  if (!userAgent) return true;
  return /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|whatsapp|headless|lighthouse|curl|wget|python-requests|httpclient|monitor/i.test(userAgent);
}
