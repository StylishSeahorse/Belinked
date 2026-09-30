import type { SocialIcon } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { AtSign, Camera, Cloud, Facebook, Github, Globe, Instagram, Linkedin, Mail, MessageCircle, Music2, Phone, Send, Twitch, Youtube } from "lucide-react";

/**
 * Social platform registry. To add a platform, add one entry here: `hosts` powers
 * URL auto-detection, `icon` or `glyph` controls the rendered mark, and
 * `normalize` can turn bare handles/emails/numbers into full URLs.
 */
type SocialPlatform = {
  id: string;
  label: string;
  hosts?: string[];
  icon?: LucideIcon;
  glyph?: string;
  placeholder: string;
  normalize?: (value: string) => string;
};

function mailto(value: string) {
  return value.startsWith("mailto:") ? value : `mailto:${value}`;
}

function tel(value: string) {
  if (value.startsWith("tel:")) return value;
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

export const socialPlatforms: SocialPlatform[] = [
  { id: "website", label: "Website", icon: Globe, placeholder: "https://example.com" },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"], icon: Instagram, placeholder: "https://instagram.com/yourhandle" },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"], glyph: "♪", placeholder: "https://tiktok.com/@yourhandle" },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], icon: Youtube, placeholder: "https://youtube.com/@yourchannel" },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"], icon: Facebook, placeholder: "https://facebook.com/yourpage" },
  { id: "x", label: "X / Twitter", hosts: ["x.com", "twitter.com"], glyph: "𝕏", placeholder: "https://x.com/yourhandle" },
  { id: "threads", label: "Threads", hosts: ["threads.net", "threads.com"], icon: AtSign, placeholder: "https://threads.net/@yourhandle" },
  { id: "bluesky", label: "Bluesky", hosts: ["bsky.app"], icon: Cloud, placeholder: "https://bsky.app/profile/you.bsky.social" },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv"], icon: Twitch, placeholder: "https://twitch.tv/yourchannel" },
  { id: "discord", label: "Discord", hosts: ["discord.gg", "discord.com"], icon: MessageCircle, placeholder: "https://discord.gg/invite" },
  { id: "spotify", label: "Spotify", hosts: ["spotify.com"], icon: Music2, placeholder: "https://open.spotify.com/artist/..." },
  { id: "soundcloud", label: "SoundCloud", hosts: ["soundcloud.com"], icon: Music2, placeholder: "https://soundcloud.com/you" },
  { id: "apple-music", label: "Apple Music", hosts: ["music.apple.com"], icon: Music2, placeholder: "https://music.apple.com/..." },
  { id: "bandcamp", label: "Bandcamp", hosts: ["bandcamp.com"], icon: Music2, placeholder: "https://you.bandcamp.com" },
  { id: "mixcloud", label: "Mixcloud", hosts: ["mixcloud.com"], icon: Music2, placeholder: "https://mixcloud.com/you" },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], icon: Linkedin, placeholder: "https://linkedin.com/in/you" },
  { id: "github", label: "GitHub", hosts: ["github.com"], icon: Github, placeholder: "https://github.com/you" },
  { id: "snapchat", label: "Snapchat", hosts: ["snapchat.com"], icon: Camera, placeholder: "https://snapchat.com/add/you" },
  { id: "pinterest", label: "Pinterest", hosts: ["pinterest.com"], glyph: "P", placeholder: "https://pinterest.com/you" },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"], icon: Send, placeholder: "https://t.me/you" },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"], icon: MessageCircle, placeholder: "https://wa.me/15551234567" },
  { id: "patreon", label: "Patreon", hosts: ["patreon.com"], glyph: "P", placeholder: "https://patreon.com/you" },
  { id: "ko-fi", label: "Ko-fi", hosts: ["ko-fi.com"], glyph: "Ko", placeholder: "https://ko-fi.com/you" },
  { id: "email", label: "Email", icon: Mail, placeholder: "you@example.com", normalize: mailto },
  { id: "phone", label: "Phone", icon: Phone, placeholder: "+1 555 123 4567", normalize: tel }
];

/** Backwards-compatible [value, label] tuples used by admin selects. */
export const socialIconOptions = socialPlatforms.map((platform) => [platform.id, platform.label] as const);

export type SocialPlacement = "top" | "bottom";

export function parseSocialPlacement(value: unknown): SocialPlacement {
  return value === "bottom" ? "bottom" : "top";
}

export function socialPlatform(id: string) {
  return socialPlatforms.find((platform) => platform.id === id?.toLowerCase());
}

export function socialLabelForIcon(icon: string) {
  return socialPlatform(icon)?.label || icon;
}

/** Guesses the platform from a URL so the owner can just paste a link. */
export function detectSocialPlatform(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith("mailto:") || /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(trimmed)) return "email";
  if (trimmed.startsWith("tel:")) return "phone";
  try {
    const host = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
    return socialPlatforms.find((platform) => platform.hosts?.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)))?.id;
  } catch {
    return undefined;
  }
}

/** Applies platform-specific normalization (e.g. bare email -> mailto:). */
export function normalizeSocialUrl(icon: string, value: string) {
  const trimmed = value.trim();
  const platform = socialPlatform(icon);
  return platform?.normalize ? platform.normalize(trimmed) : trimmed;
}

export function SocialGlyph({ social, className = "h-6 w-6" }: { social: Pick<SocialIcon, "icon" | "label">; className?: string }) {
  const platform = socialPlatform(social.icon);
  if (platform?.icon) {
    const Icon = platform.icon;
    return <Icon className={className} strokeWidth={2.2} aria-hidden="true" />;
  }
  const glyph = platform?.glyph || social.label.slice(0, 1).toUpperCase();
  return (
    <span className={className + " grid place-items-center text-[1.05rem] font-black leading-none"} aria-hidden="true">
      {glyph}
    </span>
  );
}
