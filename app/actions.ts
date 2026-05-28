"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BlockType } from "@prisma/client";
import { createOwner, login, logout, requireOwner } from "@/lib/auth";
import { addUtm } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { defaultThemes } from "@/lib/themes";
import { saveUploadedImage, saveUploadedMedia, saveUploadedVideo } from "@/lib/uploads";
import { blockSchema, profileSchema, shortLinkSchema, assertSafeRedirect } from "@/lib/validation";

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function maybeDate(value?: string) {
  return value ? new Date(value) : null;
}

async function readPlatformSettings() {
  const existing = await prisma.appSetting.findUnique({ where: { key: "platform" } });
  try {
    return JSON.parse(existing?.value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writePlatformSettings(value: Record<string, unknown>) {
  await prisma.appSetting.upsert({
    where: { key: "platform" },
    update: { value: JSON.stringify(value) },
    create: {
      key: "platform",
      value: JSON.stringify(value)
    }
  });
}

export async function setupAction(_: unknown, formData: FormData) {
  await createOwner(String(formData.get("email")), String(formData.get("password")), String(formData.get("displayName")));
  redirect("/admin/login");
}

export async function loginAction(_: unknown, formData: FormData) {
  try {
    await login(String(formData.get("email")), String(formData.get("password")));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Login failed" };
  }
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function saveProfileAction(formData: FormData) {
  await requireOwner();
  const profile = await prisma.profile.findFirstOrThrow();
  const [avatarUpload, logoUpload, ogImageUpload] = await Promise.all([
    saveUploadedImage(formData.get("avatarFile"), "profile"),
    saveUploadedImage(formData.get("logoFile"), "profile"),
    saveUploadedImage(formData.get("ogImageFile"), "profile")
  ]);
  const parsed = profileSchema.parse({
    slug: formData.get("slug"),
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    bio: formData.get("bio"),
    badge: formData.get("badge") || undefined,
    isPublished: bool(formData.get("isPublished")),
    avatarUrl: avatarUpload || formData.get("avatarUrl") || undefined,
    logoUrl: logoUpload || formData.get("logoUrl") || undefined,
    seoTitle: formData.get("seoTitle") || undefined,
    seoDescription: formData.get("seoDescription") || undefined,
    ogImageUrl: ogImageUpload || formData.get("ogImageUrl") || undefined,
    cookieNoticeEnabled: bool(formData.get("cookieNoticeEnabled")),
    priorityRedirectUrl: formData.get("priorityRedirectUrl") || undefined,
    priorityRedirectOn: bool(formData.get("priorityRedirectOn"))
  });
  await prisma.profile.update({ where: { id: profile.id }, data: parsed });
  await prisma.auditLog.create({ data: { action: "profile.updated" } });
  revalidatePath("/");
  redirect("/admin/profile");
}

export async function saveBlockAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") || "");
  const [mediaUpload, imageUpload, videoUpload] = await Promise.all([
    saveUploadedMedia(formData.get("mediaFile"), "blocks"),
    saveUploadedImage(formData.get("imageFile"), "blocks"),
    saveUploadedVideo(formData.get("videoFile"), "blocks")
  ]);
  const parsed = blockSchema.parse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url") || undefined,
    imageUrl: videoUpload || imageUpload || mediaUpload || formData.get("imageUrl") || undefined,
    icon: formData.get("icon") || undefined,
    tags: formData.get("tags") || undefined,
    internalNote: formData.get("internalNote") || undefined,
    featured: bool(formData.get("featured")),
    animation: formData.get("animation") || undefined,
    utmSource: formData.get("utmSource") || undefined,
    utmMedium: formData.get("utmMedium") || undefined,
    utmCampaign: formData.get("utmCampaign") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
    status: formData.get("status"),
    position: formData.get("position") || 0,
    metadata: formData.get("metadata") || "{}"
  });
  const normalizedUrl = parsed.url && parsed.type === BlockType.LINK ? addUtm(parsed.url, parsed.utmSource, parsed.utmMedium, parsed.utmCampaign) : parsed.url;
  const data = {
    type: parsed.type,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description ?? null,
    url: normalizedUrl ?? null,
    imageUrl: parsed.imageUrl ?? null,
    icon: parsed.icon ?? null,
    tags: parsed.tags ?? null,
    internalNote: parsed.internalNote ?? null,
    featured: parsed.featured,
    animation: parsed.animation ?? null,
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
    startsAt: maybeDate(parsed.startsAt),
    endsAt: maybeDate(parsed.endsAt),
    position: parsed.position,
    metadata: parsed.metadata
  };
  if (id) await prisma.block.update({ where: { id }, data });
  else await prisma.block.create({ data });
  await prisma.auditLog.create({ data: { action: id ? "block.updated" : "block.created" } });
  revalidatePath("/");
  redirect("/admin/blocks");
}

export async function deleteBlockAction(formData: FormData) {
  await requireOwner();
  await prisma.block.delete({ where: { id: String(formData.get("id")) } });
  await prisma.auditLog.create({ data: { action: "block.deleted" } });
  revalidatePath("/");
  redirect("/admin/blocks");
}

export async function reorderBlocksAction(ids: string[]) {
  await requireOwner();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;

  await prisma.$transaction(
    uniqueIds.map((id, index) =>
      prisma.block.update({
        where: { id },
        data: { position: index + 1 }
      })
    )
  );
  await prisma.auditLog.create({ data: { action: "blocks.reordered", metadata: JSON.stringify({ count: uniqueIds.length }) } });
  revalidatePath("/");
}

export async function saveThemeAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") || "");
  const backgroundImageUpload = await saveUploadedImage(formData.get("backgroundImageFile"), "themes");
  const settings = {
    background: String(formData.get("background")),
    foreground: String(formData.get("foreground")),
    muted: String(formData.get("muted")),
    buttonBackground: String(formData.get("buttonBackground")),
    buttonForeground: String(formData.get("buttonForeground")),
    buttonBorder: String(formData.get("buttonBorder") || formData.get("buttonBackground")),
    buttonBorderWidth: Number(formData.get("buttonBorderWidth") || 1),
    accent: String(formData.get("accent")),
    fontFamily: String(formData.get("fontFamily")),
    radius: Number(formData.get("radius") || 8),
    shadow: String(formData.get("shadow")),
    layout: String(formData.get("layout") || "stack"),
    backgroundImage: backgroundImageUpload || String(formData.get("backgroundImage") || "")
  };
  if (id) {
    await prisma.theme.update({ where: { id }, data: { name: String(formData.get("name")), settings: JSON.stringify(settings) } });
  } else {
    await prisma.theme.create({ data: { name: String(formData.get("name")), settings: JSON.stringify(settings) } });
  }
  revalidatePath("/");
  redirect("/admin/themes");
}

export async function installStarterThemesAction() {
  await requireOwner();
  for (const theme of defaultThemes) {
    await prisma.theme.upsert({
      where: { name: theme.name },
      update: { settings: JSON.stringify(theme.settings), isDefault: theme.isDefault },
      create: {
        name: theme.name,
        settings: JSON.stringify(theme.settings),
        isDefault: theme.isDefault
      }
    });
  }
  await prisma.auditLog.create({ data: { action: "themes.starters_installed" } });
  redirect("/admin/themes");
}

export async function selectThemeAction(formData: FormData) {
  await requireOwner();
  const profile = await prisma.profile.findFirstOrThrow();
  await prisma.profile.update({ where: { id: profile.id }, data: { themeId: String(formData.get("themeId")) } });
  revalidatePath("/");
  redirect("/admin/themes");
}

export async function saveShortLinkAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") || "");
  const parsed = shortLinkSchema.parse({
    code: formData.get("code"),
    destination: formData.get("destination"),
    description: formData.get("description") || undefined,
    isActive: bool(formData.get("isActive")),
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined
  });
  const data = { ...parsed, startsAt: maybeDate(parsed.startsAt), endsAt: maybeDate(parsed.endsAt) };
  if (id) await prisma.shortLink.update({ where: { id }, data });
  else await prisma.shortLink.create({ data });
  redirect("/admin/short-links");
}

export async function saveSettingsAction(formData: FormData) {
  await requireOwner();
  const current = await readPlatformSettings();
  const smtpPassword = String(formData.get("smtpPassword") || "");
  const value = {
    name: formData.get("name"),
    footerText: formData.get("footerText"),
    supportUrl: formData.get("supportUrl"),
    storageMode: "local",
    emailProvider: formData.get("emailProvider"),
    smtp: {
      host: formData.get("smtpHost"),
      port: Number(formData.get("smtpPort") || 587),
      secure: bool(formData.get("smtpSecure")),
      user: formData.get("smtpUser"),
      password: smtpPassword || (current.smtp as { password?: string } | undefined)?.password || "",
      fromName: formData.get("smtpFromName"),
      fromEmail: formData.get("smtpFromEmail")
    }
  };
  await writePlatformSettings(value);
  redirect("/admin/settings");
}

export async function saveSocialIconAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") || "");
  const data = {
    label: String(formData.get("label") || "").trim(),
    url: assertSafeRedirect(String(formData.get("url") || "").trim()),
    icon: String(formData.get("icon") || "website").trim().toLowerCase(),
    position: Number(formData.get("position") || 0),
    isVisible: bool(formData.get("isVisible"))
  };
  if (!data.label) throw new Error("Social label is required.");
  if (id) await prisma.socialIcon.update({ where: { id }, data });
  else await prisma.socialIcon.create({ data });
  await prisma.auditLog.create({ data: { action: id ? "social.updated" : "social.created" } });
  revalidatePath("/");
  redirect("/admin/socials");
}

export async function deleteSocialIconAction(formData: FormData) {
  await requireOwner();
  await prisma.socialIcon.delete({ where: { id: String(formData.get("id")) } });
  await prisma.auditLog.create({ data: { action: "social.deleted" } });
  revalidatePath("/");
  redirect("/admin/socials");
}

export async function saveSocialPlacementAction(formData: FormData) {
  await requireOwner();
  const current = await readPlatformSettings();
  const socialPlacement = formData.get("socialPlacement") === "bottom" ? "bottom" : "top";
  await writePlatformSettings({ ...current, socialPlacement });
  await prisma.auditLog.create({ data: { action: "social.placement_updated" } });
  revalidatePath("/");
  redirect("/admin/socials");
}

export async function changePasswordAction(formData: FormData) {
  const owner = await requireOwner();
  const password = String(formData.get("password"));
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  await prisma.owner.update({ where: { id: owner.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  await prisma.session.deleteMany({ where: { ownerId: owner.id } });
  redirect("/admin/login");
}
