import { BlockStatus, BlockType } from "@prisma/client";
import { UserError } from "./errors";
import { readPlatformSettings, redactPlatformSettings } from "./platform-settings";
import { prisma } from "./prisma";
import { normalizeTheme } from "./themes";
import { safeHref } from "./validation";

export const BACKUP_FORMAT = "belinked-backup";
export const BACKUP_VERSION = 1;

/**
 * Full content backup. Secrets (SMTP password, API tokens) are redacted, and the owner
 * credentials, sessions and login attempts are never exported.
 */
export async function buildBackup({ includeAnalytics = false } = {}) {
  const [profile, blocks, socials, themes, shortLinks, subscribers, settings, events] = await Promise.all([
    prisma.profile.findFirst({ include: { theme: { select: { name: true } } } }),
    prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.theme.findMany({ orderBy: { name: "asc" } }),
    prisma.shortLink.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.subscriber.findMany({ orderBy: { createdAt: "asc" } }),
    readPlatformSettings(),
    includeAnalytics ? prisma.event.findMany({ orderBy: { createdAt: "asc" } }) : Promise.resolve(undefined)
  ]);
  const { theme, ...profileData } = profile || { theme: null };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ? { ...profileData, themeName: theme?.name ?? null } : null,
    blocks,
    socials,
    themes: themes.map((item) => ({ name: item.name, isDefault: item.isDefault, settings: item.settings })),
    shortLinks,
    subscribers,
    settings: redactPlatformSettings(settings),
    ...(events ? { events } : {})
  };
}

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : null;
}

function asArray(value: unknown): Loose[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Loose => Boolean(item)) : [];
}

function str(value: unknown, max: number, fallback = "") {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function optStr(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.slice(0, max) : null;
}

function optDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9_-]{8,40}$/i.test(value) ? value : undefined;
}

function mediaUrl(value: unknown) {
  const text = optStr(value, 2048);
  if (!text) return null;
  if (/^\/uploads\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(text)) return text;
  return safeHref(text) || null;
}

/** Accepts the current backup format and the older "export all" JSON shape. */
function normalizeBackup(input: unknown) {
  const data = asRecord(input);
  if (!data) throw new UserError("That file is not a Belinked backup.");
  const legacy = !data.format && Array.isArray(data.profiles);
  if (!legacy && data.format !== BACKUP_FORMAT) throw new UserError("That file is not a Belinked backup.");
  if (!legacy && Number(data.version) > BACKUP_VERSION) throw new UserError("This backup was made by a newer version of Belinked.");
  const legacySettings = asArray(data.settings).find((item) => item.key === "platform");
  let settings: Loose | null = asRecord(data.settings);
  if (legacy) {
    try {
      settings = legacySettings ? asRecord(JSON.parse(String(legacySettings.value))) : null;
    } catch {
      settings = null;
    }
  }
  return {
    profile: legacy ? asArray(data.profiles)[0] || null : asRecord(data.profile),
    blocks: asArray(data.blocks),
    socials: asArray(data.socials),
    themes: asArray(data.themes),
    shortLinks: asArray(data.shortLinks),
    subscribers: asArray(data.subscribers),
    settings
  };
}

const blockTypes = new Set(Object.values(BlockType));
const blockStatuses = new Set(Object.values(BlockStatus));

/** Merges restored settings but keeps current secrets where the backup has them redacted. */
function mergeSettings(current: Loose, restored: Loose | null): Loose {
  if (!restored) return current;
  const merge = (base: unknown, incoming: unknown): unknown => {
    if (incoming === "__set__") return base;
    const baseRecord = asRecord(base);
    const incomingRecord = asRecord(incoming);
    if (incomingRecord) {
      return Object.fromEntries(
        [...new Set([...Object.keys(baseRecord || {}), ...Object.keys(incomingRecord)])].map((key) => [key, key in incomingRecord ? merge(baseRecord?.[key], incomingRecord[key]) : baseRecord?.[key]])
      );
    }
    return incoming;
  };
  return merge(current, restored) as Loose;
}

/**
 * Replaces content (blocks, socials, short links, profile, settings; themes are upserted
 * by name) in a single transaction, so a bad backup leaves the current data untouched.
 */
export async function restoreBackup(input: unknown, { includeSubscribers = false } = {}) {
  const backup = normalizeBackup(input);
  const blocks = backup.blocks
    .filter((block) => blockTypes.has(block.type as BlockType) && typeof block.title === "string" && block.title.trim())
    .slice(0, 2000)
    .map((block, index) => ({
      id: safeId(block.id),
      type: block.type as BlockType,
      status: blockStatuses.has(block.status as BlockStatus) ? (block.status as BlockStatus) : BlockStatus.ACTIVE,
      title: str(block.title, 120),
      description: optStr(block.description, 400),
      url: optStr(block.url, 2048) && safeHref(String(block.url)) ? String(block.url) : null,
      imageUrl: mediaUrl(block.imageUrl),
      icon: optStr(block.icon, 40),
      tags: optStr(block.tags, 160),
      internalNote: optStr(block.internalNote, 400),
      featured: block.featured === true,
      animation: optStr(block.animation, 40),
      utmSource: optStr(block.utmSource, 80),
      utmMedium: optStr(block.utmMedium, 80),
      utmCampaign: optStr(block.utmCampaign, 80),
      startsAt: optDate(block.startsAt),
      endsAt: optDate(block.endsAt),
      position: index + 1,
      metadata: (() => {
        try {
          const parsed = JSON.parse(str(block.metadata, 4000, "{}"));
          return asRecord(parsed) ? JSON.stringify(parsed) : "{}";
        } catch {
          return "{}";
        }
      })()
    }));
  const socials = backup.socials
    .filter((social) => typeof social.label === "string" && safeHref(str(social.url, 2048)))
    .slice(0, 100)
    .map((social, index) => ({
      label: str(social.label, 60),
      url: str(social.url, 2048),
      icon: /^[a-z0-9-]{1,30}$/.test(str(social.icon, 30)) ? str(social.icon, 30) : "website",
      position: index + 1,
      isVisible: social.isVisible !== false
    }));
  const shortLinks = backup.shortLinks
    .filter((link) => /^[a-zA-Z0-9_-]{2,40}$/.test(str(link.code, 40)) && safeHref(str(link.destination, 2048)))
    .slice(0, 1000)
    .map((link) => ({
      code: str(link.code, 40),
      destination: str(link.destination, 2048),
      description: optStr(link.description, 160),
      isActive: link.isActive !== false,
      startsAt: optDate(link.startsAt),
      endsAt: optDate(link.endsAt)
    }));
  const themes = backup.themes
    .filter((theme) => typeof theme.name === "string" && theme.name.trim())
    .slice(0, 100)
    .map((theme) => {
      let settings: Loose = {};
      try {
        settings = asRecord(typeof theme.settings === "string" ? JSON.parse(theme.settings) : theme.settings) || {};
      } catch {
        settings = {};
      }
      return { name: str(theme.name, 60), isDefault: theme.isDefault === true, settings: JSON.stringify(normalizeTheme(settings)) };
    });
  const uniqueCodes = new Set(shortLinks.map((link) => link.code));
  if (uniqueCodes.size !== shortLinks.length) throw new UserError("The backup contains duplicate short link codes.");

  const currentSettings = await readPlatformSettings();
  const subscribers = includeSubscribers
    ? backup.subscribers
        .map((subscriber) => ({ email: str(subscriber.email, 254).toLowerCase(), name: optStr(subscriber.name, 120), source: optStr(subscriber.source, 120), consent: subscriber.consent !== false, createdAt: optDate(subscriber.createdAt) || new Date() }))
        .filter((subscriber) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subscriber.email))
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.block.deleteMany();
    await tx.socialIcon.deleteMany();
    await tx.shortLink.deleteMany();
    for (const block of blocks) await tx.block.create({ data: block });
    for (const social of socials) await tx.socialIcon.create({ data: social });
    for (const link of shortLinks) await tx.shortLink.create({ data: link });
    for (const theme of themes) {
      await tx.theme.upsert({ where: { name: theme.name }, update: { settings: theme.settings }, create: theme });
    }
    if (includeSubscribers) {
      await tx.subscriber.deleteMany();
      for (const subscriber of subscribers) await tx.subscriber.create({ data: subscriber });
    }
    const profile = await tx.profile.findFirst();
    const incoming = backup.profile;
    if (profile && incoming) {
      const themeName = optStr(incoming.themeName, 60);
      const theme = themeName ? await tx.theme.findUnique({ where: { name: themeName } }) : null;
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          displayName: str(incoming.displayName, 80, profile.displayName) || profile.displayName,
          username: str(incoming.username, 80, profile.username),
          bio: str(incoming.bio, 280, profile.bio),
          badge: optStr(incoming.badge, 60),
          isPublished: incoming.isPublished !== false,
          avatarUrl: mediaUrl(incoming.avatarUrl),
          logoUrl: mediaUrl(incoming.logoUrl),
          seoTitle: optStr(incoming.seoTitle, 100),
          seoDescription: optStr(incoming.seoDescription, 180),
          ogImageUrl: mediaUrl(incoming.ogImageUrl),
          cookieNoticeEnabled: incoming.cookieNoticeEnabled !== false,
          allowIndexing: incoming.allowIndexing !== false,
          priorityRedirectUrl: safeHref(str(incoming.priorityRedirectUrl, 2048)) || null,
          priorityRedirectOn: incoming.priorityRedirectOn === true && Boolean(safeHref(str(incoming.priorityRedirectUrl, 2048))),
          ...(theme ? { themeId: theme.id } : {})
        }
      });
    }
    await tx.appSetting.upsert({
      where: { key: "platform" },
      update: { value: JSON.stringify(mergeSettings(currentSettings, backup.settings)) },
      create: { key: "platform", value: JSON.stringify(mergeSettings(currentSettings, backup.settings)) }
    });
  });

  return { blocks: blocks.length, socials: socials.length, themes: themes.length, shortLinks: shortLinks.length, subscribers: subscribers.length };
}
