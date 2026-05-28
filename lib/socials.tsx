import type { SocialIcon } from "@prisma/client";
import { Facebook, Globe, Instagram, Music2, Send, Twitch, Youtube } from "lucide-react";

export const socialIconOptions = [
  ["website", "Website"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["youtube", "YouTube"],
  ["spotify", "Spotify"],
  ["soundcloud", "SoundCloud"],
  ["tiktok", "TikTok"],
  ["x", "X / Twitter"],
  ["telegram", "Telegram"],
  ["twitch", "Twitch"]
] as const;

export type SocialPlacement = "top" | "bottom";

export function parseSocialPlacement(value: unknown): SocialPlacement {
  return value === "bottom" ? "bottom" : "top";
}

export function socialLabelForIcon(icon: string) {
  const match = socialIconOptions.find(([value]) => value === icon);
  return match?.[1] || icon;
}

export function SocialGlyph({ social, className = "h-6 w-6" }: { social: Pick<SocialIcon, "icon" | "label">; className?: string }) {
  const icon = social.icon?.toLowerCase();
  if (icon === "instagram") return <Instagram className={className} strokeWidth={2.2} />;
  if (icon === "facebook") return <Facebook className={className} strokeWidth={2.2} />;
  if (icon === "youtube") return <Youtube className={className} strokeWidth={2.2} />;
  if (icon === "spotify") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "soundcloud") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "tiktok") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "x") return <span className={className + " grid place-items-center text-[1.1rem] font-black"} aria-hidden="true">X</span>;
  if (icon === "telegram") return <Send className={className} strokeWidth={2.2} />;
  if (icon === "twitch") return <Twitch className={className} strokeWidth={2.2} />;
  if (icon === "website") return <Globe className={className} strokeWidth={2.2} />;
  return <span className={className + " grid place-items-center text-sm font-black"} aria-hidden="true">{social.label.slice(0, 1).toUpperCase()}</span>;
}
