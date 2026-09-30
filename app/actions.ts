"use server";

import { BlockType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, changeOwnerPassword, createOwner, login, logout, requireOwner, revokeOtherSessions, verifyOwnerPassword } from "@/lib/auth";
import { parseBlockMetadata } from "@/lib/block-metadata";
import { restoreBackup } from "@/lib/backup";
import { importLinksFromCsv } from "@/lib/csv";
import { UserError, userMessage } from "@/lib/errors";
import { runFormAction } from "@/lib/form-action";
import { checkLinkHealth } from "@/lib/link-health";
import { clearMetaIntegrationCache } from "@/lib/meta-integration";
import { insertAfter, layoutFromRows } from "@/lib/ordering";
import { readPlatformSettings, writePlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { normalizeSmtpConfig, testSmtpConnection } from "@/lib/smtp-test";
import { detectSocialPlatform, normalizeSocialUrl, socialLabelForIcon } from "@/lib/socials";
import { defaultThemes, normalizeTheme } from "@/lib/themes";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";
import { cleanupUnusedUploads } from "@/lib/upload-cleanup";
import { saveUploadedImage, saveUploadedMedia, saveUploadedVideo } from "@/lib/uploads";
import { blockSchema, profileSchema, shortLinkSchema, socialSchema } from "@/lib/validation";

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(formData: FormData, key: string) {
  return text(formData, key).trim() || undefined;
}

async function audit(action: string, metadata: Record<string, unknown> = {}) {
  await prisma.auditLog.create({ data: { action, metadata: JSON.stringify(metadata) } });
}

function refreshPublic() {
  revalidatePath("/");
}

/** Rewrites block positions to a dense 1..n sequence in the given order. */
async function writeBlockOrder(order: string[]) {
  await prisma.$transaction(order.map((id, index) => prisma.block.update({ where: { id }, data: { position: index + 1 } })));
}

async function currentBlockOrder() {
  const blocks = await prisma.block.findMany({ select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return blocks.map((block) => block.id);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthFormState = { error?: string; needsTotp?: boolean; email?: string; displayName?: string } | null;

export async function setupAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    if (text(formData, "password") !== text(formData, "confirmPassword")) throw new UserError("Passwords do not match.");
    await createOwner(text(formData, "email"), text(formData, "password"), text(formData, "displayName"));
  } catch (error) {
    return { error: userMessage(error), email: text(formData, "email").slice(0, 254), displayName: text(formData, "displayName").slice(0, 80) };
  }
  redirect("/admin/login?notice=Owner%20account%20created.%20Sign%20in%20to%20continue.");
}

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const result = await login(text(formData, "email"), text(formData, "password"), text(formData, "totp"));
    if (!result.ok) return { error: result.error, needsTotp: result.needsTotp, email: text(formData, "email").slice(0, 254) };
  } catch (error) {
    return { error: userMessage(error, "Sign in failed. Please try again."), email: text(formData, "email").slice(0, 254) };
  }
  const next = text(formData, "next");
  // Only allow local admin paths as post-login destinations (no open redirect).
  redirect(/^\/admin(\/[a-z0-9-]*)*$/.test(next) ? next : "/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function changePasswordAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#security", async () => {
    if (text(formData, "password") !== text(formData, "confirmPassword")) throw new UserError("New passwords do not match.");
    await changeOwnerPassword(owner.id, text(formData, "currentPassword"), text(formData, "password"));
    return "Password changed. Other sessions were signed out.";
  });
}

export async function revokeSessionsAction() {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#security", async () => {
    const count = await revokeOtherSessions(owner.id);
    return count ? `Signed out ${count} other session${count === 1 ? "" : "s"}.` : "No other sessions were active.";
  });
}

export async function startTotpSetupAction() {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#security", async () => {
    if (owner.totpEnabled) throw new UserError("Two-factor authentication is already enabled.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpSecret: generateTotpSecret(), totpEnabled: false } });
    return "Scan the QR code, then enter a code to finish enabling two-factor authentication.";
  });
}

export async function confirmTotpAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#security", async () => {
    if (!owner.totpSecret) throw new UserError("Start two-factor setup first.");
    if (!verifyTotp(owner.totpSecret, text(formData, "code"))) throw new UserError("That code is not valid. Check your device's clock and try again.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpEnabled: true } });
    await audit("auth.totp_enabled");
    return "Two-factor authentication is enabled.";
  });
}

export async function disableTotpAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#security", async () => {
    if (!(await verifyOwnerPassword(owner.id, text(formData, "currentPassword")))) throw new AuthError("Your current password is incorrect.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpEnabled: false, totpSecret: null } });
    await audit("auth.totp_disabled");
    return "Two-factor authentication is disabled.";
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function saveProfileAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/profile", async () => {
    const profile = await prisma.profile.findFirstOrThrow();
    const [avatarUpload, logoUpload, ogImageUpload] = await Promise.all([
      saveUploadedImage(formData.get("avatarFile"), "profile"),
      saveUploadedImage(formData.get("logoFile"), "profile"),
      saveUploadedImage(formData.get("ogImageFile"), "profile")
    ]);
    const parsed = profileSchema.parse({
      slug: optionalText(formData, "slug") || profile.slug,
      displayName: text(formData, "displayName"),
      username: text(formData, "username").replace(/^@/, ""),
      bio: text(formData, "bio"),
      badge: optionalText(formData, "badge"),
      isPublished: bool(formData.get("isPublished")),
      avatarUrl: bool(formData.get("removeAvatar")) ? undefined : avatarUpload || optionalText(formData, "avatarUrl"),
      logoUrl: bool(formData.get("removeLogo")) ? undefined : logoUpload || optionalText(formData, "logoUrl"),
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
      ogImageUrl: bool(formData.get("removeOgImage")) ? undefined : ogImageUpload || optionalText(formData, "ogImageUrl"),
      cookieNoticeEnabled: bool(formData.get("cookieNoticeEnabled")),
      allowIndexing: bool(formData.get("allowIndexing")),
      priorityRedirectUrl: optionalText(formData, "priorityRedirectUrl"),
      priorityRedirectOn: bool(formData.get("priorityRedirectOn"))
    });
    if (parsed.priorityRedirectOn && !parsed.priorityRedirectUrl) throw new UserError("Add a redirect URL before turning on the profile redirect.");
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        ...parsed,
        badge: parsed.badge || null,
        avatarUrl: parsed.avatarUrl ?? null,
        logoUrl: parsed.logoUrl ?? null,
        seoTitle: parsed.seoTitle || null,
        seoDescription: parsed.seoDescription || null,
        ogImageUrl: parsed.ogImageUrl ?? null,
        priorityRedirectUrl: parsed.priorityRedirectUrl ?? null
      }
    });
    await audit("profile.updated");
    refreshPublic();
    return "Profile saved.";
  });
}

export async function togglePublishedAction() {
  await requireOwner();
  await runFormAction("/admin", async () => {
    const profile = await prisma.profile.findFirstOrThrow();
    await prisma.profile.update({ where: { id: profile.id }, data: { isPublished: !profile.isPublished } });
    await audit(profile.isPublished ? "profile.unpublished" : "profile.published");
    refreshPublic();
    return profile.isPublished ? "Your page is now unpublished." : "Your page is live.";
  });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export async function saveBlockAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "id");
  await runFormAction(id ? `/admin/blocks#block-${id}` : "/admin/blocks", async () => {
    const [mediaUpload, imageUpload, videoUpload] = await Promise.all([
      saveUploadedMedia(formData.get("mediaFile"), "blocks"),
      saveUploadedImage(formData.get("imageFile"), "blocks"),
      saveUploadedVideo(formData.get("videoFile"), "blocks")
    ]);
    const parsed = blockSchema.parse({
      type: text(formData, "type"),
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      url: optionalText(formData, "url"),
      imageUrl: videoUpload || imageUpload || mediaUpload || optionalText(formData, "imageUrl"),
      icon: optionalText(formData, "icon"),
      tags: optionalText(formData, "tags"),
      internalNote: optionalText(formData, "internalNote"),
      featured: bool(formData.get("featured")),
      animation: optionalText(formData, "animation"),
      utmSource: optionalText(formData, "utmSource"),
      utmMedium: optionalText(formData, "utmMedium"),
      utmCampaign: optionalText(formData, "utmCampaign"),
      startsAt: optionalText(formData, "startsAt"),
      endsAt: optionalText(formData, "endsAt"),
      status: text(formData, "status") || "ACTIVE",
      metadata: text(formData, "metadata")
    });
    if (parsed.type === BlockType.LINK && !parsed.url) throw new UserError("URL: add where this link should go.");

    const existing = id ? await prisma.block.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new UserError("That block no longer exists.");
    // Keep the row grouping chosen in the layout editor when the metadata is edited.
    const metadata = parseBlockMetadata(parsed.metadata) as Record<string, unknown>;
    const previousGroup = parseBlockMetadata(existing?.metadata).inlineGroupSize;
    if (previousGroup && metadata.inlineGroupSize === undefined) metadata.inlineGroupSize = previousGroup;

    const data = {
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description ?? null,
      // Store the URL as entered; UTM parameters are applied at click time.
      url: parsed.url ?? null,
      imageUrl: bool(formData.get("removeMedia")) ? null : parsed.imageUrl ?? null,
      icon: parsed.icon ?? null,
      tags: parsed.tags ?? null,
      internalNote: parsed.internalNote ?? null,
      featured: parsed.featured,
      animation: parsed.animation ?? null,
      utmSource: parsed.utmSource ?? null,
      utmMedium: parsed.utmMedium ?? null,
      utmCampaign: parsed.utmCampaign ?? null,
      startsAt: parsed.startsAt ?? null,
      endsAt: parsed.endsAt ?? null,
      metadata: JSON.stringify(metadata)
    };
    if (existing) {
      await prisma.block.update({ where: { id }, data });
    } else {
      const last = await prisma.block.aggregate({ _max: { position: true } });
      await prisma.block.create({ data: { ...data, position: (last._max.position || 0) + 1 } });
    }
    await audit(existing ? "block.updated" : "block.created", { type: parsed.type });
    refreshPublic();
    return existing ? "Block saved." : "Block added to the end of your page.";
  });
}

export async function deleteBlockAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/blocks", async () => {
    await prisma.block.delete({ where: { id: text(formData, "id") } });
    await writeBlockOrder(await currentBlockOrder());
    await audit("block.deleted");
    refreshPublic();
    return "Block deleted.";
  });
}

export async function duplicateBlockAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/blocks", async () => {
    const source = await prisma.block.findUniqueOrThrow({ where: { id: text(formData, "id") } });
    const metadata = parseBlockMetadata(source.metadata) as Record<string, unknown>;
    delete metadata.inlineGroupSize;
    const { id: sourceId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
    void _createdAt;
    void _updatedAt;
    const copy = await prisma.block.create({
      data: { ...rest, title: `${source.title} (copy)`.slice(0, 120), status: "HIDDEN", metadata: JSON.stringify(metadata), position: source.position + 1 }
    });
    await writeBlockOrder(insertAfter(await currentBlockOrder(), copy.id, sourceId));
    await audit("block.duplicated");
    return "Block duplicated. The copy is hidden until you enable it.";
  });
}

export async function toggleBlockStatusAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "id");
  await runFormAction(`/admin/blocks#block-${id}`, async () => {
    const block = await prisma.block.findUniqueOrThrow({ where: { id } });
    const status = block.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    await prisma.block.update({ where: { id }, data: { status } });
    await audit("block.status_changed", { status });
    refreshPublic();
    return status === "ACTIVE" ? `"${block.title}" is now visible.` : `"${block.title}" is now hidden.`;
  });
}

/** Legacy flat reorder API, kept for compatibility. */
export async function reorderBlocksAction(ids: string[]) {
  return saveBlockLayoutAction(ids.map((id) => [id]));
}

export async function saveBlockLayoutAction(rows: string[][]): Promise<{ ok: boolean; error?: string }> {
  await requireOwner();
  try {
    if (!Array.isArray(rows) || rows.length > 1000) throw new UserError("Invalid layout.");
    const blocks = await prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    const byId = new Map(blocks.map((block) => [block.id, block]));
    const layout = layoutFromRows(
      rows.map((row) => (Array.isArray(row) ? row.map(String) : [])),
      blocks.map((block) => block.id),
      (id) => {
        const block = byId.get(id);
        return Boolean(block && block.type === BlockType.LINK && !block.featured);
      }
    );
    await prisma.$transaction(
      layout.map((entry) => {
        const metadata = parseBlockMetadata(byId.get(entry.id)?.metadata) as Record<string, unknown>;
        if (entry.groupSize > 1) metadata.inlineGroupSize = entry.groupSize;
        else delete metadata.inlineGroupSize;
        return prisma.block.update({ where: { id: entry.id }, data: { position: entry.position, metadata: JSON.stringify(metadata) } });
      })
    );
    await audit("blocks.layout_updated", { count: layout.length });
    refreshPublic();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: userMessage(error, "Could not save the new order. Refresh and try again.") };
  }
}

export async function importLinksCsvAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/blocks", async () => {
    const file = formData.get("csvFile");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a CSV file to import.");
    if (file.size > 512 * 1024) throw new UserError("CSV files must be 512KB or smaller.");
    const result = await importLinksFromCsv(await file.text());
    await audit("blocks.csv_imported", result);
    refreshPublic();
    return `Imported ${result.created} link${result.created === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped} invalid row${result.skipped === 1 ? "" : "s"}` : ""}.`;
  });
}

export async function checkLinksAction() {
  await requireOwner();
  await runFormAction("/admin/blocks", async () => {
    const results = await checkLinkHealth();
    const broken = results.filter((result) => !result.ok).length;
    return broken ? `Checked ${results.length} links: ${broken} may be broken (see the warnings below).` : `Checked ${results.length} links: all reachable.`;
  });
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export async function saveThemeAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "id");
  await runFormAction("/admin/themes", async () => {
    const [backgroundImageUpload, backgroundVideoUpload] = await Promise.all([
      saveUploadedImage(formData.get("backgroundImageFile"), "themes"),
      saveUploadedVideo(formData.get("backgroundVideoFile"), "themes")
    ]);
    const name = text(formData, "name").trim().slice(0, 60);
    if (!name) throw new UserError("Give the theme a name.");
    const raw = Object.fromEntries(
      ["background", "foreground", "muted", "buttonBackground", "buttonForeground", "buttonBorder", "buttonBorderWidth", "accent", "fontFamily", "radius", "shadow", "layout", "backgroundOverlay", "backgroundBlur", "avatarShape", "hoverEffect", "entrance", "maxWidth", "spacing", "fontSize", "buttonFill"].map((key) => [key, text(formData, key)])
    );
    const imageInput = bool(formData.get("removeBackgroundImage")) ? "" : backgroundImageUpload || text(formData, "backgroundImage");
    const videoInput = bool(formData.get("removeBackgroundVideo")) ? "" : backgroundVideoUpload || text(formData, "backgroundVideo");
    const settings = normalizeTheme({ ...raw, backgroundImage: imageInput, backgroundVideo: videoInput });
    if (imageInput && !settings.backgroundImage) throw new UserError("Background image must be an uploaded file or an http(s) URL.");
    if (videoInput && !settings.backgroundVideo) throw new UserError("Background video must be an uploaded file or an http(s) URL.");
    if (id) {
      await prisma.theme.update({ where: { id }, data: { name, settings: JSON.stringify(settings) } });
    } else {
      const theme = await prisma.theme.create({ data: { name, settings: JSON.stringify(settings) } });
      if (bool(formData.get("applyNow"))) {
        const profile = await prisma.profile.findFirstOrThrow();
        await prisma.profile.update({ where: { id: profile.id }, data: { themeId: theme.id } });
      }
    }
    await audit(id ? "theme.updated" : "theme.created");
    refreshPublic();
    return id ? "Theme saved." : "Theme created.";
  });
}

export async function deleteThemeAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/themes", async () => {
    const id = text(formData, "id");
    const profile = await prisma.profile.findFirst();
    if (profile?.themeId === id) throw new UserError("This theme is in use. Choose another theme first.");
    await prisma.theme.delete({ where: { id } });
    await audit("theme.deleted");
    return "Theme deleted.";
  });
}

export async function installStarterThemesAction() {
  await requireOwner();
  await runFormAction("/admin/themes", async () => {
    for (const theme of defaultThemes) {
      await prisma.theme.upsert({
        where: { name: theme.name },
        update: { settings: JSON.stringify(theme.settings), isDefault: theme.isDefault },
        create: { name: theme.name, settings: JSON.stringify(theme.settings), isDefault: theme.isDefault }
      });
    }
    await audit("themes.starters_installed");
    refreshPublic();
    return "Starter themes installed.";
  });
}

export async function selectThemeAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/themes", async () => {
    const theme = await prisma.theme.findUniqueOrThrow({ where: { id: text(formData, "themeId") } });
    const profile = await prisma.profile.findFirstOrThrow();
    await prisma.profile.update({ where: { id: profile.id }, data: { themeId: theme.id } });
    await audit("theme.selected", { name: theme.name });
    refreshPublic();
    return `"${theme.name}" is now your page theme.`;
  });
}

// ---------------------------------------------------------------------------
// Short links
// ---------------------------------------------------------------------------

export async function saveShortLinkAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/short-links", async () => {
    const id = text(formData, "id");
    const parsed = shortLinkSchema.parse({
      code: text(formData, "code"),
      destination: text(formData, "destination"),
      description: optionalText(formData, "description"),
      isActive: bool(formData.get("isActive")),
      startsAt: optionalText(formData, "startsAt"),
      endsAt: optionalText(formData, "endsAt")
    });
    const data = { ...parsed, description: parsed.description ?? null, startsAt: parsed.startsAt ?? null, endsAt: parsed.endsAt ?? null };
    if (id) await prisma.shortLink.update({ where: { id }, data });
    else await prisma.shortLink.create({ data });
    await audit(id ? "short_link.updated" : "short_link.created", { code: parsed.code });
    return id ? "Short link saved." : `Short link /s/${parsed.code} created.`;
  });
}

export async function deleteShortLinkAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/short-links", async () => {
    const link = await prisma.shortLink.delete({ where: { id: text(formData, "id") } });
    await audit("short_link.deleted", { code: link.code });
    return `Short link /s/${link.code} deleted.`;
  });
}

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

export async function saveSocialIconAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/socials", async () => {
    const id = text(formData, "id");
    const rawUrl = text(formData, "url").trim();
    const selected = text(formData, "icon").trim().toLowerCase();
    const icon = selected === "auto" || !selected ? detectSocialPlatform(rawUrl) || "website" : selected;
    const parsed = socialSchema.parse({
      label: optionalText(formData, "label") || socialLabelForIcon(icon),
      url: normalizeSocialUrl(icon, rawUrl),
      icon,
      isVisible: bool(formData.get("isVisible"))
    });
    if (id) {
      await prisma.socialIcon.update({ where: { id }, data: parsed });
    } else {
      const last = await prisma.socialIcon.aggregate({ _max: { position: true } });
      await prisma.socialIcon.create({ data: { ...parsed, position: (last._max.position || 0) + 1 } });
    }
    await audit(id ? "social.updated" : "social.created", { icon });
    refreshPublic();
    return id ? "Social link saved." : `${parsed.label} added.`;
  });
}

export async function deleteSocialIconAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/socials", async () => {
    await prisma.socialIcon.delete({ where: { id: text(formData, "id") } });
    await audit("social.deleted");
    refreshPublic();
    return "Social link deleted.";
  });
}

export async function moveSocialIconAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/socials", async () => {
    const socials = await prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    const index = socials.findIndex((social) => social.id === text(formData, "id"));
    const target = index + (text(formData, "direction") === "up" ? -1 : 1);
    if (index === -1 || target < 0 || target >= socials.length) return "Already at the edge.";
    const order = socials.map((social) => social.id);
    [order[index], order[target]] = [order[target], order[index]];
    await prisma.$transaction(order.map((id, position) => prisma.socialIcon.update({ where: { id }, data: { position: position + 1 } })));
    refreshPublic();
    return "Order updated.";
  });
}

export async function saveSocialPlacementAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/socials", async () => {
    const current = await readPlatformSettings();
    const socialPlacement = formData.get("socialPlacement") === "bottom" ? "bottom" : "top";
    await writePlatformSettings({ ...current, socialPlacement });
    await audit("social.placement_updated");
    refreshPublic();
    return "Placement saved.";
  });
}

// ---------------------------------------------------------------------------
// Settings, SMTP and integrations
// ---------------------------------------------------------------------------

export type SmtpTestActionState = { ok: boolean; message: string } | null;

function platformSettingsFromForm(formData: FormData, current: Record<string, unknown>) {
  const currentSmtp = current.smtp as { password?: string } | undefined;
  const currentMeta = current.meta as { facebookAccessToken?: string; instagramAccessToken?: string } | undefined;
  const smtpPassword = text(formData, "smtpPassword");
  const instagramAccessToken = text(formData, "metaInstagramAccessToken").trim();
  const facebookAccessToken = text(formData, "metaFacebookAccessToken").trim();
  const port = Number(text(formData, "smtpPort") || 587);
  return {
    ...current,
    name: text(formData, "name").slice(0, 80),
    footerText: text(formData, "footerText").slice(0, 200),
    storageMode: "local",
    emailProvider: text(formData, "emailProvider") === "smtp" ? "smtp" : "disabled",
    smtp: {
      host: text(formData, "smtpHost").trim().slice(0, 253),
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
      secure: bool(formData.get("smtpSecure")),
      user: text(formData, "smtpUser").slice(0, 200),
      password: bool(formData.get("clearSmtpPassword")) ? "" : smtpPassword || currentSmtp?.password || "",
      fromName: text(formData, "smtpFromName").slice(0, 80),
      fromEmail: text(formData, "smtpFromEmail").slice(0, 254)
    },
    meta: {
      enabled: bool(formData.get("metaEnabled")),
      graphVersion: /^v\d+\.\d+$/.test(text(formData, "metaGraphVersion").trim()) ? text(formData, "metaGraphVersion").trim() : "v23.0",
      instagramUserId: text(formData, "metaInstagramUserId").replace(/\D/g, ""),
      instagramAccessToken: bool(formData.get("clearMetaTokens")) ? "" : instagramAccessToken || currentMeta?.instagramAccessToken || "",
      facebookPageId: text(formData, "metaFacebookPageId").replace(/\D/g, ""),
      facebookAccessToken: bool(formData.get("clearMetaTokens")) ? "" : facebookAccessToken || currentMeta?.facebookAccessToken || ""
    }
  };
}

export async function saveSettingsAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings", async () => {
    const current = await readPlatformSettings();
    await writePlatformSettings(platformSettingsFromForm(formData, current));
    clearMetaIntegrationCache();
    await audit("settings.updated");
    refreshPublic();
    return "Settings saved.";
  });
}

export async function testSmtpSettingsAction(_: SmtpTestActionState, formData: FormData): Promise<SmtpTestActionState> {
  await requireOwner();
  const current = await readPlatformSettings();
  const settings = platformSettingsFromForm(formData, current);
  if (settings.emailProvider !== "smtp") {
    return { ok: false, message: "Switch the email provider to smtp before testing the connection." };
  }

  try {
    const smtp = normalizeSmtpConfig(settings.smtp as Record<string, unknown>);
    await testSmtpConnection(smtp);
    await audit("smtp.test_succeeded", { host: smtp.host, port: smtp.port, secure: smtp.secure });
    return { ok: true, message: `SMTP connection succeeded for ${smtp.host}:${smtp.port}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP connection failed.";
    await audit("smtp.test_failed", { message });
    return { ok: false, message };
  }
}

// ---------------------------------------------------------------------------
// Data: restore and maintenance
// ---------------------------------------------------------------------------

export async function restoreBackupAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings#data", async () => {
    if (text(formData, "confirm").trim() !== "RESTORE") throw new UserError('Type RESTORE to confirm replacing your current content.');
    if (!(await verifyOwnerPassword(owner.id, text(formData, "currentPassword")))) throw new AuthError("Your current password is incorrect.");
    const file = formData.get("backupFile");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a Belinked JSON backup file.");
    if (file.size > 20 * 1024 * 1024) throw new UserError("Backup files must be 20MB or smaller.");
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw new UserError("That file is not valid JSON.");
    }
    const summary = await restoreBackup(json, { includeSubscribers: bool(formData.get("includeSubscribers")) });
    await audit("backup.restored", summary);
    clearMetaIntegrationCache();
    refreshPublic();
    return `Backup restored: ${summary.blocks} blocks, ${summary.socials} socials, ${summary.themes} themes, ${summary.shortLinks} short links.`;
  });
}

export async function cleanupUploadsAction() {
  await requireOwner();
  await runFormAction("/admin/settings#data", async () => {
    const result = await cleanupUnusedUploads();
    await audit("uploads.cleaned", result);
    return result.deleted ? `Removed ${result.deleted} unused file${result.deleted === 1 ? "" : "s"} (${(result.bytes / 1024 / 1024).toFixed(1)}MB).` : "No unused uploads found.";
  });
}

export async function purgeAnalyticsAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings#data", async () => {
    const days = Number(text(formData, "olderThanDays"));
    if (![30, 90, 180, 365].includes(days)) throw new UserError("Choose a retention period.");
    const result = await prisma.event.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } });
    await audit("analytics.purged", { days, count: result.count });
    return `Deleted ${result.count} analytics event${result.count === 1 ? "" : "s"} older than ${days} days.`;
  });
}
