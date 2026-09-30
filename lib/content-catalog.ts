import type { BlockType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  CalendarDays,
  Gift,
  Heading,
  Image as ImageIcon,
  Link2,
  Mail,
  Minus,
  Mic,
  Music,
  Music2,
  Newspaper,
  Phone,
  Play,
  QrCode,
  ShoppingBag,
  Tv,
  Type,
  Youtube,
  Code2
} from "lucide-react";

/**
 * The "+ Add" menu. Each entry maps to an existing block type with sensible defaults,
 * so new kinds of content are added here without touching the editor.
 */
export type CatalogItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Essentials" | "Media" | "Grow & sell";
  /** Block to create; "socials" and "qr" open other tools instead. */
  type: BlockType | "socials" | "qr";
  urlLabel?: string;
  urlPlaceholder?: string;
  titlePlaceholder?: string;
  requiresUrl?: boolean;
  bodyField?: boolean;
  upload?: boolean;
  metadata?: Record<string, unknown>;
  keywords?: string;
};

export const catalog: CatalogItem[] = [
  { id: "link", label: "Link", description: "Any website, post or page", icon: Link2, group: "Essentials", type: "LINK", urlPlaceholder: "https://", titlePlaceholder: "My website", requiresUrl: true, keywords: "url button website" },
  { id: "header", label: "Heading", description: "Split your page into sections", icon: Heading, group: "Essentials", type: "HEADER", titlePlaceholder: "Latest releases", keywords: "title section" },
  { id: "text", label: "Text", description: "A short paragraph or announcement", icon: Type, group: "Essentials", type: "TEXT", titlePlaceholder: "About me", bodyField: true, keywords: "paragraph note" },
  { id: "image", label: "Image", description: "A picture, optionally linked", icon: ImageIcon, group: "Essentials", type: "IMAGE", upload: true, urlLabel: "Link when tapped (optional)", urlPlaceholder: "https://", titlePlaceholder: "Caption (optional)", keywords: "photo picture" },
  { id: "socials", label: "Social icons", description: "Instagram, TikTok, YouTube and more", icon: AtSign, group: "Essentials", type: "socials", keywords: "instagram tiktok x twitter profiles" },
  { id: "divider", label: "Divider", description: "A thin line between sections", icon: Minus, group: "Essentials", type: "SEPARATOR", keywords: "separator line spacer" },

  { id: "youtube", label: "YouTube", description: "Play a video right on your page", icon: Youtube, group: "Media", type: "VIDEO", urlLabel: "YouTube link", urlPlaceholder: "https://youtube.com/watch?v=…", requiresUrl: true, titlePlaceholder: "Latest video", keywords: "video" },
  { id: "video", label: "Video", description: "Vimeo, Twitch or an uploaded file", icon: Play, group: "Media", type: "VIDEO", urlLabel: "Video link", urlPlaceholder: "https://vimeo.com/…", requiresUrl: true, titlePlaceholder: "Watch this", keywords: "vimeo twitch" },
  { id: "spotify", label: "Spotify", description: "Track, album, playlist or podcast", icon: Music2, group: "Media", type: "MUSIC", urlLabel: "Spotify link", urlPlaceholder: "https://open.spotify.com/…", requiresUrl: true, titlePlaceholder: "Listen now", keywords: "music song" },
  { id: "soundcloud", label: "SoundCloud", description: "Stream a track or set", icon: Music, group: "Media", type: "MUSIC", urlLabel: "SoundCloud link", urlPlaceholder: "https://soundcloud.com/…", requiresUrl: true, titlePlaceholder: "New track", keywords: "music mixcloud apple bandcamp" },
  { id: "twitch", label: "Twitch", description: "Show your live stream", icon: Tv, group: "Media", type: "VIDEO", urlLabel: "Twitch channel link", urlPlaceholder: "https://twitch.tv/…", requiresUrl: true, titlePlaceholder: "I'm live", keywords: "stream live gaming" },
  { id: "podcast", label: "Podcast", description: "Spotify or Apple Podcasts player", icon: Mic, group: "Media", type: "PODCAST", urlLabel: "Episode or show link", urlPlaceholder: "https://podcasts.apple.com/…", requiresUrl: true, titlePlaceholder: "Latest episode", keywords: "episode audio" },
  { id: "embed", label: "Other embed", description: "Mixcloud, Apple Music, Bandcamp…", icon: Code2, group: "Media", type: "EMBED", urlLabel: "Share link", urlPlaceholder: "https://", requiresUrl: true, titlePlaceholder: "Now playing", keywords: "iframe player" },

  { id: "signup", label: "Email signup", description: "Collect subscribers on your page", icon: Mail, group: "Grow & sell", type: "SUBSCRIBER_FORM", titlePlaceholder: "Join my mailing list", bodyField: true, keywords: "newsletter subscribe list" },
  { id: "newsletter", label: "Newsletter", description: "Link to your Substack, Ghost…", icon: Newspaper, group: "Grow & sell", type: "NEWSLETTER", urlPlaceholder: "https://", requiresUrl: true, titlePlaceholder: "Read my newsletter", keywords: "substack ghost" },
  { id: "event", label: "Event / booking", description: "Tickets, RSVPs or appointments", icon: CalendarDays, group: "Grow & sell", type: "CALENDAR", urlPlaceholder: "https://", requiresUrl: true, titlePlaceholder: "Get tickets", keywords: "calendar tickets booking rsvp" },
  { id: "product", label: "Product", description: "Feature something you sell", icon: ShoppingBag, group: "Grow & sell", type: "PRODUCT", urlPlaceholder: "https://shop…", requiresUrl: true, titlePlaceholder: "Limited tee", keywords: "shop store merch" },
  { id: "tip", label: "Tip / donation", description: "Ko-fi, PayPal, Buy Me a Coffee…", icon: Gift, group: "Grow & sell", type: "LINK", urlPlaceholder: "https://ko-fi.com/…", requiresUrl: true, titlePlaceholder: "Support my work ☕", metadata: { buttonLabel: "Tip" }, keywords: "donate support kofi paypal patreon" },
  { id: "contact", label: "Contact", description: "Email or call button", icon: Phone, group: "Grow & sell", type: "CONTACT", urlLabel: "Email or phone", urlPlaceholder: "mailto:you@example.com", requiresUrl: true, titlePlaceholder: "Get in touch", keywords: "email phone call" },
  { id: "qr", label: "QR code", description: "Download a QR code for your page", icon: QrCode, group: "Grow & sell", type: "qr", keywords: "print poster share" }
];

export const catalogGroups = ["Essentials", "Media", "Grow & sell"] as const;

/** Best icon for an existing block in the editor list. */
export function iconForBlock(type: BlockType, url?: string | null): LucideIcon {
  if (url) {
    if (/youtu/.test(url)) return Youtube;
    if (/spotify/.test(url)) return Music2;
    if (/twitch/.test(url)) return Tv;
  }
  const match = catalog.find((item) => item.type === type);
  return match?.icon || Link2;
}

/** Contact blocks accept bare emails / phone numbers for convenience. */
export function normalizeContactUrl(value: string) {
  const trimmed = value.trim();
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(trimmed)) return `mailto:${trimmed}`;
  if (/^\+?[\d\s().-]{6,}$/.test(trimmed)) return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
  return trimmed;
}

/** Lets people type "example.com" without the scheme. */
export function normalizeWebUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+(\/|$|\?)/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}
