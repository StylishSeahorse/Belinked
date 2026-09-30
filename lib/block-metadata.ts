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

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

function youtube(id?: string | null) {
  return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
}

/** Hostname used for Twitch's required `parent` parameter. */
function appHostname() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost").hostname;
  } catch {
    return "localhost";
  }
}

export type EmbedKind = "video" | "audio" | "tall";

/**
 * Converts a share URL from a known provider into its official embed player URL.
 * Anything not on this allow-list returns undefined and is never iframed.
 */
export function resolveEmbed(value?: string | null): { src: string; kind: EmbedKind; provider: string } | undefined {
  const url = safeHttpUrl(value);
  if (!url || url.protocol !== "https:") return undefined;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const src = youtube(parts[0]);
    return src ? { src, kind: "video", provider: "YouTube" } : undefined;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : url.searchParams.get("v");
    const src = youtube(id);
    return src ? { src, kind: "video", provider: "YouTube" } : undefined;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((part) => /^\d+$/.test(part));
    return id ? { src: `https://player.vimeo.com/video/${id}?dnt=1`, kind: "video", provider: "Vimeo" } : undefined;
  }
  if (host === "open.spotify.com") {
    const path = parts[0] === "embed" ? parts.slice(1) : parts.filter((part) => !part.startsWith("intl-"));
    const [kind, id] = path;
    if (!["track", "album", "playlist", "artist", "episode", "show"].includes(kind) || !/^[A-Za-z0-9]+$/.test(id || "")) return undefined;
    const tall = ["album", "playlist", "artist", "show"].includes(kind);
    return { src: `https://open.spotify.com/embed/${kind}/${id}`, kind: tall ? "tall" : "audio", provider: "Spotify" };
  }
  if (host === "soundcloud.com") {
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&visual=false`, kind: "audio", provider: "SoundCloud" };
  }
  if (host === "mixcloud.com" && parts.length >= 2) {
    return { src: `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(`/${parts.join("/")}/`)}`, kind: "audio", provider: "Mixcloud" };
  }
  if (host === "apple.com" && (url.hostname.startsWith("music.") || url.hostname.startsWith("embed.music."))) {
    return { src: `https://embed.music.apple.com${url.pathname}${url.search}`, kind: "tall", provider: "Apple Music" };
  }
  if (url.hostname === "podcasts.apple.com" || url.hostname === "embed.podcasts.apple.com") {
    return { src: `https://embed.podcasts.apple.com${url.pathname}${url.search}`, kind: "tall", provider: "Apple Podcasts" };
  }
  if (host === "twitch.tv" || host === "player.twitch.tv") {
    const parent = encodeURIComponent(appHostname());
    if (parts[0] === "videos" && /^\d+$/.test(parts[1] || "")) {
      return { src: `https://player.twitch.tv/?video=${parts[1]}&parent=${parent}&autoplay=false`, kind: "video", provider: "Twitch" };
    }
    const channel = url.searchParams.get("channel") || parts[0];
    if (channel && /^[A-Za-z0-9_]{2,30}$/.test(channel)) {
      return { src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false`, kind: "video", provider: "Twitch" };
    }
    return undefined;
  }
  if (host === "bandcamp.com" && url.pathname.startsWith("/EmbeddedPlayer/")) {
    return { src: url.toString(), kind: "audio", provider: "Bandcamp" };
  }
  return undefined;
}

export function resolveEmbedUrl(value?: string | null) {
  return resolveEmbed(value)?.src;
}
