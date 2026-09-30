import { headers } from "next/headers";

/**
 * Public base URL. APP_URL is authoritative (and should be set in production, including
 * when serving from a custom domain); otherwise fall back to the request host.
 */
export async function siteUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to request host
    }
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

export function absoluteUrl(base: string, path?: string | null) {
  if (!path) return undefined;
  try {
    return new URL(path, base).toString();
  } catch {
    return undefined;
  }
}
