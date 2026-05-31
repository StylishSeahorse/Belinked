export type ParsedBlockMetadata = {
  buttonLabel?: string;
  caption?: string;
  embedUrl?: string;
  inlineGroupSize?: number;
  inputPlaceholder?: string;
  price?: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  submitLabel?: string;
};

export function parseBlockMetadata(value?: string | null): ParsedBlockMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ParsedBlockMetadata;
  } catch {
    return {};
  }
}

function safeHttpUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

const supportedEmbedHosts = [
  "youtu.be",
  "youtube.com",
  "youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
  "open.spotify.com",
  "soundcloud.com"
];

function isSupportedEmbedHost(host: string) {
  return supportedEmbedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function resolveEmbedUrl(value?: string | null) {
  const url = safeHttpUrl(value);
  if (!url) return undefined;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!isSupportedEmbedHost(host)) return undefined;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  }

  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (url.pathname.startsWith("/embed/")) return url.toString();
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      return id ? `https://www.youtube.com/embed/${id}` : undefined;
    }
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  }

  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : undefined;
  }

  if (host.endsWith("spotify.com")) {
    if (url.pathname.startsWith("/embed/")) return url.toString();
    return `https://open.spotify.com/embed${url.pathname}`;
  }

  if (host === "soundcloud.com") {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}`;
  }

  return undefined;
}
