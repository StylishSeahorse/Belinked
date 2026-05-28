import dns from "node:dns/promises";
import net from "node:net";

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function attr(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeHtml(match[1] || match[2] || match[3] || "") : undefined;
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = attr(tag, "property") || attr(tag, "name") || attr(tag, "itemprop");
    if (property?.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return undefined;
}

function title(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function linkHref(html: string, rel: string) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const value = attr(tag, "rel");
    if (value?.toLowerCase().split(/\s+/).includes(rel.toLowerCase())) return attr(tag, "href");
  }
  return undefined;
}

function firstUsefulImage(html: string) {
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const src =
      attr(tag, "src") ||
      attr(tag, "data-src") ||
      attr(tag, "data-lazy-src") ||
      attr(tag, "data-original") ||
      firstSrcsetCandidate(attr(tag, "srcset") || attr(tag, "data-srcset") || "");
    const width = Number(attr(tag, "width") || 0);
    const height = Number(attr(tag, "height") || 0);
    if (!src) continue;
    if (/pixel|spacer|tracking|avatar|icon|logo/i.test(src)) continue;
    if ((width && width < 120) || (height && height < 80)) continue;
    return src;
  }
  return undefined;
}

function firstSrcsetCandidate(srcset: string) {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .find(Boolean);
}

function jsonLdImages(html: string) {
  const scripts = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const images: string[] = [];

  function collect(value: unknown) {
    if (!value || images.length > 10) return;
    if (typeof value === "string") {
      if (/^https?:\/\//i.test(value) || value.startsWith("/")) images.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    collect(record.image);
    collect(record.thumbnailUrl);
    collect(record.logo);
    collect(record.url);
  }

  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      collect(JSON.parse(raw));
    } catch {
      continue;
    }
  }

  return images.find((image) => !/pixel|spacer|tracking/i.test(image));
}

function isPrivateIp(address: string) {
  if (net.isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  return address === "::1" || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd");
}

async function assertPublicHttpUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs can be previewed.");
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)) throw new Error("Local URLs cannot be previewed.");
  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.some((item) => isPrivateIp(item.address))) throw new Error("Private network URLs cannot be previewed.");
  return url;
}

export async function fetchLinkPreview(input: string) {
  const url = await assertPublicHttpUrl(input);
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      "user-agent": "Belinked link preview bot/0.1",
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) throw new Error(`Preview request failed with ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("URL did not return an HTML page.");
  const html = (await response.text()).slice(0, 400_000);
  return extractLinkPreviewFromHtml(html, response.url, url.hostname);
}

export function extractLinkPreviewFromHtml(html: string, baseUrl: string, fallbackTitle: string) {
  const image =
    meta(html, "og:image:secure_url") ||
    meta(html, "og:image:url") ||
    meta(html, "og:image") ||
    meta(html, "twitter:image:src") ||
    meta(html, "twitter:image") ||
    meta(html, "image") ||
    linkHref(html, "image_src") ||
    jsonLdImages(html) ||
    firstUsefulImage(html);
  return {
    title: meta(html, "og:title") || meta(html, "twitter:title") || title(html) || fallbackTitle,
    description: meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description") || "",
    imageUrl: image ? new URL(image, baseUrl).toString() : ""
  };
}
