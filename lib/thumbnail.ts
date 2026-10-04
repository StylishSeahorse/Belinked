import { fetchLinkPreview } from "./link-preview";
import { safeFetch } from "./safe-fetch";
import { saveImageBytes } from "./uploads";

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024;

/** Downloads one image URL (SSRF-safe) and stores it like an upload. Returns null on any failure. */
async function downloadImage(url: string) {
  try {
    const response = await safeFetch(url, { maxBytes: MAX_THUMBNAIL_BYTES, timeoutMs: 8000, headers: { accept: "image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1" } });
    if (response.status < 200 || response.status >= 300 || response.truncated) return null;
    return await saveImageBytes(response.bytes, String(response.headers["content-type"] || ""), "blocks");
  } catch {
    return null;
  }
}

/**
 * Finds a thumbnail for a web page: its preview image (og:image and friends), falling
 * back to the site's icon. The image is copied into local uploads so the public page
 * never hot-links third-party servers.
 */
export async function fetchThumbnailFor(pageUrl: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(pageUrl)) return null;
  const preview = await fetchLinkPreview(pageUrl);
  for (const candidate of [preview.imageUrl, preview.iconUrl]) {
    if (!candidate) continue;
    const stored = await downloadImage(candidate);
    if (stored) return stored;
  }
  return null;
}
