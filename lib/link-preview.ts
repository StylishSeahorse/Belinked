import { safeFetch } from "./safe-fetch";

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

export async function fetchLinkPreview(input: string) {
  const response = await safeFetch(input, { headers: { accept: "text/html,application/xhtml+xml" }, maxBytes: 400_000 });
  if (response.status < 200 || response.status >= 300) throw new Error(`Preview request failed with ${response.status}.`);
  const contentType = String(response.headers["content-type"] || "");
  if (!contentType.includes("text/html")) throw new Error("URL did not return an HTML page.");
  return extractLinkPreviewFromHtml(response.body, response.url, new URL(response.url).hostname);
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
    imageUrl: image ? httpImage(image, baseUrl) : "",
    iconUrl: bestIcon(html, baseUrl)
  };
}

/**
 * The site's largest raster icon (apple-touch-icon preferred), used as a thumbnail
 * when a page has no preview image. SVG and .ico are skipped.
 */
export function bestIcon(html: string, baseUrl: string) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const candidates: Array<{ href: string; score: number }> = [];
  for (const tag of tags) {
    const rel = (attr(tag, "rel") || "").toLowerCase().split(/\s+/);
    const href = attr(tag, "href");
    if (!href || !(rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed") || rel.includes("icon"))) continue;
    const type = (attr(tag, "type") || "").toLowerCase();
    if (/\.(svg|ico)(\?|#|$)/i.test(href) || type.includes("svg") || type.includes("icon")) continue;
    const size = Math.max(0, ...(attr(tag, "sizes") || "").split(/\s+/).map((value) => Number(value.split("x")[0]) || 0));
    candidates.push({ href, score: (rel.includes("icon") ? 0 : 1000) + (size || (rel.includes("icon") ? 16 : 180)) });
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best ? httpImage(best.href, baseUrl) : "";
}

function httpImage(image: string, baseUrl: string) {
  try {
    const url = new URL(image, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}
