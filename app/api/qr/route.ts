import QRCode from "qrcode";
import { requireOwner } from "@/lib/auth";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function hex(value: string | null, fallback: string) {
  return value && /^#?[0-9a-f]{6}$/i.test(value) ? `#${value.replace("#", "")}` : fallback;
}

export async function GET(request: Request) {
  await requireOwner();
  const url = new URL(request.url);
  const target = `${await siteUrl()}/`;
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  const size = Math.min(4096, Math.max(128, Number(url.searchParams.get("size")) || 1024));
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 2,
    color: { dark: hex(url.searchParams.get("dark"), "#151515"), light: hex(url.searchParams.get("light"), "#ffffff") }
  };
  const download = url.searchParams.get("download") === "1";
  const disposition: Record<string, string> = download ? { "content-disposition": `attachment; filename="profile-qr.${format}"` } : {};

  if (format === "svg") {
    const svg = await QRCode.toString(target, { ...options, type: "svg" });
    return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "no-store", ...disposition } });
  }
  const png = await QRCode.toBuffer(target, { ...options, width: size });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "no-store", ...disposition } });
}
