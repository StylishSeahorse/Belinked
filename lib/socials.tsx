import type { SocialIcon } from "@prisma/client";
import { Camera, Facebook, Github, Globe, Instagram, Linkedin, Mail, MessageCircle, Music2, Send, Twitch, Youtube } from "lucide-react";

export const socialIconOptions = [
  ["website", "Website"],
  ["instagram", "Instagram"],
  ["threads", "Threads"],
  ["snapchat", "Snapchat"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["youtube", "YouTube"],
  ["spotify", "Spotify"],
  ["soundcloud", "SoundCloud"],
  ["apple-music", "Apple Music"],
  ["bandcamp", "Bandcamp"],
  ["tiktok", "TikTok"],
  ["x", "X / Twitter"],
  ["pinterest", "Pinterest"],
  ["discord", "Discord"],
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"],
  ["twitch", "Twitch"],
  ["github", "GitHub"],
  ["patreon", "Patreon"],
  ["ko-fi", "Ko-fi"],
  ["email", "Email"]
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
  if (icon === "threads") return <span className={className + " grid place-items-center text-[1.1rem] font-black"} aria-hidden="true">@</span>;
  if (icon === "snapchat") return <Camera className={className} strokeWidth={2.2} />;
  if (icon === "linkedin") return <Linkedin className={className} strokeWidth={2.2} />;
  if (icon === "facebook") return <Facebook className={className} strokeWidth={2.2} />;
  if (icon === "youtube") return <Youtube className={className} strokeWidth={2.2} />;
  if (icon === "spotify") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "soundcloud") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "apple-music") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "bandcamp") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "tiktok") return <Music2 className={className} strokeWidth={2.2} />;
  if (icon === "x") return <span className={className + " grid place-items-center text-[1.1rem] font-black"} aria-hidden="true">X</span>;
  if (icon === "pinterest") return <span className={className + " grid place-items-center text-[1.1rem] font-black"} aria-hidden="true">P</span>;
  if (icon === "discord") return <MessageCircle className={className} strokeWidth={2.2} />;
  if (icon === "whatsapp") return <MessageCircle className={className} strokeWidth={2.2} />;
  if (icon === "telegram") return <Send className={className} strokeWidth={2.2} />;
  if (icon === "twitch") return <Twitch className={className} strokeWidth={2.2} />;
  if (icon === "github") return <Github className={className} strokeWidth={2.2} />;
  if (icon === "patreon") return <span className={className + " grid place-items-center text-[1.1rem] font-black"} aria-hidden="true">P</span>;
  if (icon === "ko-fi") return <span className={className + " grid place-items-center text-[1rem] font-black"} aria-hidden="true">Ko</span>;
  if (icon === "email") return <Mail className={className} strokeWidth={2.2} />;
  if (icon === "website") return <Globe className={className} strokeWidth={2.2} />;
  return <span className={className + " grid place-items-center text-sm font-black"} aria-hidden="true">{social.label.slice(0, 1).toUpperCase()}</span>;
}
