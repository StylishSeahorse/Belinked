"use server";

import type { BlockStatus, BlockType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseBlockMetadata } from "@/lib/block-metadata";
import { type ActionResult, CUSTOM_THEME_NAME, type EditorBlock, type EditorSocial, serializeBlock, serializeSocial } from "@/lib/editor-types";
import { UserError, userMessage } from "@/lib/errors";
import { insertAfter } from "@/lib/ordering";
import { readPlatformSettings, writePlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { detectSocialPlatform, normalizeSocialUrl, socialLabelForIcon } from "@/lib/socials";
import { normalizeTheme, type ThemeSettings } from "@/lib/themes";
import { isPackIcon } from "@/lib/icon-pack";
import { fetchThumbnailFor } from "@/lib/thumbnail";
import { saveUploadedImage, saveUploadedMedia } from "@/lib/uploads";
import { blockSchema, profileSchema, socialSchema } from "@/lib/validation";

/*
 * JSON server actions for the visual editor. Unlike the form actions in actions.ts they
 * never redirect: the editor updates optimistically, autosaves, and shows the result.
 */

async function run<T>(fn: () => Promise<T>, fallback?: string): Promise<ActionResult<T>> {
  try {
    await requireOwner();
    return { ok: true, data: await fn() };
  } catch (error) {
    // requireOwner redirects when signed out; let Next handle that.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false, error: userMessage(error, fallback) };
  }
}

async function audit(action: string, metadata: Record<string, unknown> = {}) {
  await prisma.auditLog.create({ data: { action, metadata: JSON.stringify(metadata) } });
}

function refresh() {
  revalidatePath("/");
}

async function blockOrder() {
  return (await prisma.block.findMany({ select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] })).map((block) => block.id);
}

async function writeOrder(order: string[]) {
  await prisma.$transaction(order.map((id, index) => prisma.block.update({ where: { id }, data: { position: index + 1 } })));
}

// ---------------------------------------------------------------------------
// Profile & publishing
// ---------------------------------------------------------------------------

export type ProfilePatch = Partial<{ displayName: string; bio: string; badge: string | null; avatarUrl: string | null; logoUrl: string | null; cookieNoticeEnabled: boolean }>;

export async function updateProfile(patch: ProfilePatch) {
  return run(async () => {
    const schema = profileSchema.pick({ displayName: true, bio: true, badge: true, avatarUrl: true, logoUrl: true, cookieNoticeEnabled: true }).partial();
    const input = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === null ? undefined : value]));
    const parsed = schema.parse(input);
    const data: Record<string, unknown> = { ...parsed };
    for (const key of ["badge", "avatarUrl", "logoUrl"] as const) {
      if (key in patch && !patch[key]) data[key] = null;
    }
    const profile = await prisma.profile.findFirstOrThrow();
    await prisma.profile.update({ where: { id: profile.id }, data });
    refresh();
    return null;
  });
}

export async function setPublished(isPublished: boolean) {
  return run(async () => {
    const profile = await prisma.profile.findFirstOrThrow();
    await prisma.profile.update({ where: { id: profile.id }, data: { isPublished } });
    await audit(isPublished ? "profile.published" : "profile.unpublished");
    refresh();
    return isPublished;
  });
}

export async function setSocialPlacement(placement: "top" | "bottom") {
  return run(async () => {
    const current = await readPlatformSettings();
    await writePlatformSettings({ ...current, socialPlacement: placement === "bottom" ? "bottom" : "top" });
    refresh();
    return null;
  });
}

export async function dismissOnboarding() {
  return run(async () => {
    const current = await readPlatformSettings();
    await writePlatformSettings({ ...current, onboardingDismissed: true });
    return null;
  });
}

/** Uploads an image (or, for kind "media", image or video) and returns its public path. */
export async function uploadFile(formData: FormData) {
  return run(async () => {
    const folder = ["profile", "blocks", "themes"].includes(String(formData.get("folder"))) ? String(formData.get("folder")) : "blocks";
    const file = formData.get("file");
    const path = formData.get("kind") === "media" ? await saveUploadedMedia(file, folder) : await saveUploadedImage(file, folder);
    if (!path) throw new UserError("Choose a file to upload.");
    return path;
  }, "Upload failed. Try a different file.");
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export type BlockInput = {
  type: BlockType;
  title?: string;
  url?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type BlockPatch = Partial<{
  title: string;
  url: string | null;
  description: string | null;
  imageUrl: string | null;
  featured: boolean;
  animation: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  internalNote: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: BlockStatus;
  icon: string | null;
  metadata: Record<string, unknown>;
}>;

function validated(block: Omit<EditorBlock, "id" | "position" | "icon" | "tags"> & { icon?: string | null; tags?: string | null }) {
  const parsed = blockSchema.parse({
    type: block.type,
    title: block.title,
    description: block.description || undefined,
    url: block.url || undefined,
    imageUrl: block.imageUrl || undefined,
    icon: block.icon || undefined,
    tags: block.tags || undefined,
    internalNote: block.internalNote || undefined,
    featured: block.featured,
    animation: block.animation || undefined,
    utmSource: block.utmSource || undefined,
    utmMedium: block.utmMedium || undefined,
    utmCampaign: block.utmCampaign || undefined,
    startsAt: block.startsAt || undefined,
    endsAt: block.endsAt || undefined,
    status: block.status,
    metadata: block.metadata
  });
  return {
    type: parsed.type,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description ?? null,
    url: parsed.url ?? null,
    imageUrl: parsed.imageUrl ?? null,
    icon: parsed.icon ?? null,
    featured: parsed.featured,
    animation: parsed.animation ?? null,
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
    internalNote: parsed.internalNote ?? null,
    startsAt: parsed.startsAt ?? null,
    endsAt: parsed.endsAt ?? null,
    metadata: parsed.metadata
  };
}

const DEFAULT_TITLES: Partial<Record<BlockType, string>> = {
  SEPARATOR: "Divider",
  HEADER: "New section",
  TEXT: "Text",
  IMAGE: "Image",
  SUBSCRIBER_FORM: "Join my mailing list"
};

export async function createBlock(input: BlockInput): Promise<ActionResult<EditorBlock>> {
  return run(async () => {
    let title = input.title?.trim() || DEFAULT_TITLES[input.type] || "";
    if (!title && input.url) {
      try {
        title = new URL(input.url).hostname.replace(/^www\./, "");
      } catch {
        title = "";
      }
    }
    if (input.type === "LINK" && !input.url) throw new UserError("Add the URL this link should open.");
    if (input.type === "IMAGE" && !input.imageUrl) throw new UserError("Upload an image first.");
    const data = validated({
      type: input.type,
      title,
      url: input.url || null,
      description: input.description || null,
      imageUrl: input.imageUrl || null,
      featured: false,
      animation: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      internalNote: null,
      startsAt: null,
      endsAt: null,
      status: "ACTIVE",
      metadata: JSON.stringify(input.metadata || {})
    });
    const last = await prisma.block.aggregate({ _max: { position: true } });
    const block = await prisma.block.create({ data: { ...data, position: (last._max.position || 0) + 1 } });
    await audit("block.created", { type: block.type });
    refresh();
    return serializeBlock(block);
  });
}

export async function updateBlock(id: string, patch: BlockPatch): Promise<ActionResult<EditorBlock>> {
  return run(async () => {
    const existing = await prisma.block.findUnique({ where: { id } });
    if (!existing) throw new UserError("That block no longer exists. Refresh the page.");
    const current = serializeBlock(existing);
    const metadata = patch.metadata ? { ...parseBlockMetadata(existing.metadata), ...patch.metadata } : parseBlockMetadata(existing.metadata);
    for (const [key, value] of Object.entries(metadata)) if (value === "" || value === null) delete (metadata as Record<string, unknown>)[key];
    const merged = { ...current, ...patch, metadata: JSON.stringify(metadata) };
    if (merged.type === "LINK" && !merged.url) throw new UserError("A link needs a URL.");
    if (merged.icon && !isPackIcon(merged.icon)) throw new UserError("Choose an icon from the list.");
    // Validate the whole block, but write only what changed, so a concurrent update
    // (e.g. an auto-fetched thumbnail) is never overwritten with stale values.
    const validatedData = validated(merged);
    const data = Object.fromEntries(Object.entries(validatedData).filter(([key]) => key in patch));
    const block = await prisma.block.update({ where: { id }, data });
    refresh();
    return serializeBlock(block);
  });
}

export async function deleteBlock(id: string) {
  return run(async () => {
    await prisma.block.delete({ where: { id } });
    await writeOrder(await blockOrder());
    await audit("block.deleted");
    refresh();
    return null;
  });
}

export async function duplicateBlock(id: string): Promise<ActionResult<EditorBlock>> {
  return run(async () => {
    const source = await prisma.block.findUniqueOrThrow({ where: { id } });
    const metadata = parseBlockMetadata(source.metadata) as Record<string, unknown>;
    delete metadata.inlineGroupSize;
    const { id: sourceId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
    void _createdAt;
    void _updatedAt;
    const copy = await prisma.block.create({ data: { ...rest, title: `${source.title} (copy)`.slice(0, 120), status: "HIDDEN", metadata: JSON.stringify(metadata) } });
    await writeOrder(insertAfter(await blockOrder(), copy.id, sourceId));
    await audit("block.duplicated");
    return serializeBlock(await prisma.block.findUniqueOrThrow({ where: { id: copy.id } }));
  });
}

/** Block types whose card shows a thumbnail fetched from the linked page. */
const THUMBNAIL_TYPES = new Set(["LINK", "PRODUCT", "NEWSLETTER", "CALENDAR"]);

/**
 * Fills a block's thumbnail from the page it links to.
 * - "auto": after adding a link or changing its URL. Never replaces an uploaded image,
 *   respects a removed auto thumbnail, and doesn't retry a URL it already tried.
 * - "missing": bulk fill for links without any image (still respects removals).
 * - "refresh": the explicit "Fetch from link" button; always tries.
 */
export async function autoThumbnail(id: string, mode: "auto" | "missing" | "refresh" = "auto"): Promise<ActionResult<{ block: EditorBlock; found: boolean }>> {
  return run(async () => {
    const block = await prisma.block.findUnique({ where: { id } });
    if (!block) throw new UserError("That link no longer exists.");
    const metadata = parseBlockMetadata(block.metadata) as Record<string, unknown>;
    const unchanged = { block: serializeBlock(block), found: false };
    const isWebLink = Boolean(block.url && /^https?:\/\//i.test(block.url) && THUMBNAIL_TYPES.has(block.type));
    if (!isWebLink) {
      if (mode === "refresh") throw new UserError("Only web links can fetch a thumbnail.");
      return unchanged;
    }
    if (mode !== "refresh") {
      if (metadata.autoThumbnail === "off" || block.icon) return unchanged; // removed, or an icon was chosen
      if (block.imageUrl && metadata.autoThumbnail !== true) return unchanged; // owner's own image
      if (mode === "missing" && block.imageUrl) return unchanged;
      if (mode === "auto" && metadata.thumbnailSource === block.url) return unchanged;
    }

    let image: string | null = null;
    try {
      image = await fetchThumbnailFor(block.url!);
    } catch {
      image = null;
    }
    metadata.thumbnailSource = block.url;
    if (!image) {
      await prisma.block.update({ where: { id }, data: { metadata: JSON.stringify(metadata) } });
      if (mode === "refresh") throw new UserError("Couldn't find an image on that page. You can upload one instead.");
      return unchanged;
    }
    metadata.autoThumbnail = true;
    const updated = await prisma.block.update({ where: { id }, data: { imageUrl: image, icon: null, metadata: JSON.stringify(metadata) } });
    refresh();
    return { block: serializeBlock(updated), found: true };
  });
}

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

export async function addSocial(url: string, icon?: string): Promise<ActionResult<EditorSocial>> {
  return run(async () => {
    const detected = icon && icon !== "auto" ? icon : detectSocialPlatform(url) || "website";
    const parsed = socialSchema.parse({ label: socialLabelForIcon(detected), url: normalizeSocialUrl(detected, url), icon: detected, isVisible: true });
    const last = await prisma.socialIcon.aggregate({ _max: { position: true } });
    const social = await prisma.socialIcon.create({ data: { ...parsed, position: (last._max.position || 0) + 1 } });
    await audit("social.created", { icon: detected });
    refresh();
    return serializeSocial(social);
  });
}

export async function updateSocial(id: string, patch: Partial<Pick<EditorSocial, "url" | "icon" | "label" | "isVisible">>): Promise<ActionResult<EditorSocial>> {
  return run(async () => {
    const existing = await prisma.socialIcon.findUniqueOrThrow({ where: { id } });
    const icon = patch.icon ?? existing.icon;
    const parsed = socialSchema.parse({
      label: patch.label ?? (patch.icon ? socialLabelForIcon(icon) : existing.label),
      url: normalizeSocialUrl(icon, patch.url ?? existing.url),
      icon,
      isVisible: patch.isVisible ?? existing.isVisible
    });
    const social = await prisma.socialIcon.update({ where: { id }, data: parsed });
    refresh();
    return serializeSocial(social);
  });
}

export async function deleteSocial(id: string) {
  return run(async () => {
    await prisma.socialIcon.delete({ where: { id } });
    await audit("social.deleted");
    refresh();
    return null;
  });
}

export async function reorderSocials(ids: string[]) {
  return run(async () => {
    const existing = new Set((await prisma.socialIcon.findMany({ select: { id: true } })).map((social) => social.id));
    const order = [...new Set(ids)].filter((id) => existing.has(id));
    await prisma.$transaction(order.map((id, index) => prisma.socialIcon.update({ where: { id }, data: { position: index + 1 } })));
    refresh();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export async function selectTheme(themeId: string) {
  return run(async () => {
    const theme = await prisma.theme.findUniqueOrThrow({ where: { id: themeId } });
    const profile = await prisma.profile.findFirstOrThrow();
    await prisma.profile.update({ where: { id: profile.id }, data: { themeId: theme.id } });
    await audit("theme.selected", { name: theme.name });
    refresh();
    return theme.id;
  });
}

/**
 * Saves appearance edits. Presets stay pristine: edits are written to the owner's
 * custom theme, which becomes the active theme.
 */
export async function saveCustomTheme(settings: ThemeSettings): Promise<ActionResult<{ id: string; name: string }>> {
  return run(async () => {
    const normalized = JSON.stringify(normalizeTheme(settings as unknown as Record<string, unknown>));
    const theme = await prisma.theme.upsert({ where: { name: CUSTOM_THEME_NAME }, update: { settings: normalized }, create: { name: CUSTOM_THEME_NAME, settings: normalized } });
    const profile = await prisma.profile.findFirstOrThrow();
    if (profile.themeId !== theme.id) await prisma.profile.update({ where: { id: profile.id }, data: { themeId: theme.id } });
    refresh();
    return { id: theme.id, name: theme.name };
  });
}
