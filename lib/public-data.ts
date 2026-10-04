import type { Block, Profile, SocialIcon } from "@prisma/client";
import { isBlockVisible } from "./blocks";
import { parseBlockMetadata, resolveEmbed, type EmbedKind } from "./block-metadata";
import { safeThemeMediaUrl } from "./themes";
import { safeHref } from "./validation";

/**
 * Public-facing shapes. Everything rendered on the public page goes through these
 * mappers so private fields (internal notes, tags, raw URLs, UTM settings, hidden or
 * scheduled blocks) never reach the browser.
 */
export type PublicBlock = {
  id: string;
  type: Block["type"];
  title: string;
  description: string | null;
  href: string | null;
  imageUrl: string | null;
  featured: boolean;
  animation: string | null;
  embed: { src: string; kind: EmbedKind; provider: string } | null;
  inlineGroupSize: number;
  meta: {
    buttonLabel?: string;
    caption?: string;
    price?: string;
    secondaryUrl?: string;
    secondaryLabel?: string;
    inputPlaceholder?: string;
    submitLabel?: string;
  };
};

export type PublicSocial = { id: string; label: string; icon: string; url: string };

export type PublicProfileData = {
  id: string;
  displayName: string;
  bio: string;
  badge: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  cookieNoticeEnabled: boolean;
};

function shortText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

const EMBED_TYPES = new Set(["VIDEO", "MUSIC", "PODCAST", "EMBED"]);

export function toPublicBlock(block: Block): PublicBlock {
  const metadata = parseBlockMetadata(block.metadata);
  const embed = EMBED_TYPES.has(block.type) ? resolveEmbed(metadata.embedUrl || block.url) || null : null;
  const size = Number(metadata.inlineGroupSize || 1);
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    description: block.description,
    // Outbound links always go through the click tracker, which re-validates the target.
    href: block.url && safeHref(block.url) ? `/api/click/${block.id}` : null,
    imageUrl: safeThemeMediaUrl(block.imageUrl) || null,
    featured: block.featured,
    animation: block.animation === "pulse" ? "pulse" : null,
    embed,
    inlineGroupSize: size === 2 || size === 3 ? size : 1,
    meta: {
      buttonLabel: shortText(metadata.buttonLabel, 40),
      caption: shortText(metadata.caption, 200),
      price: shortText(metadata.price, 30),
      secondaryUrl: safeHref(typeof metadata.secondaryUrl === "string" ? metadata.secondaryUrl : undefined),
      secondaryLabel: shortText(metadata.secondaryLabel, 40),
      inputPlaceholder: shortText(metadata.inputPlaceholder, 60),
      submitLabel: shortText(metadata.submitLabel, 40)
    }
  };
}

export function publicBlocks(blocks: Block[], at = new Date()): PublicBlock[] {
  return blocks.filter((block) => isBlockVisible(block, at)).map(toPublicBlock);
}

export function publicSocials(socials: SocialIcon[]): PublicSocial[] {
  return socials.flatMap((social) => {
    const url = safeHref(social.url);
    return social.isVisible && url ? [{ id: social.id, label: social.label, icon: social.icon, url }] : [];
  });
}

export function toPublicProfile(profile: Profile): PublicProfileData {
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    badge: profile.badge,
    avatarUrl: safeThemeMediaUrl(profile.avatarUrl) || null,
    logoUrl: safeThemeMediaUrl(profile.logoUrl) || null,
    cookieNoticeEnabled: profile.cookieNoticeEnabled
  };
}
