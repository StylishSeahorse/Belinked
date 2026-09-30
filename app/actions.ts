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
import { layoutFromRows } from "@/lib/ordering";
import { readPlatformSettings, writePlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { normalizeSmtpConfig, testSmtpConnection } from "@/lib/smtp-test";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";
import { cleanupUnusedUploads } from "@/lib/upload-cleanup";
import { saveUploadedImage } from "@/lib/uploads";
import { profileSchema, shortLinkSchema } from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthFormState = { error?: string; needsTotp?: boolean; email?: string; displayName?: string } | null;

export async function setupAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    if (text(formData, "password") !== text(formData, "confirmPassword")) throw new UserError("Passwords do not match.");
    const owner = await createOwner(text(formData, "email"), text(formData, "password"), text(formData, "displayName"));
    // Use the owner's name on the page straight away, then sign them in.
    const profile = await prisma.profile.findFirst();
    if (profile) await prisma.profile.update({ where: { id: profile.id }, data: { displayName: owner.displayName } });
    await login(text(formData, "email"), text(formData, "password"));
  } catch (error) {
    return { error: userMessage(error), email: text(formData, "email").slice(0, 254), displayName: text(formData, "displayName").slice(0, 80) };
  }
  redirect("/admin");
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
  await runFormAction("/admin/settings?tab=security", async () => {
    if (text(formData, "password") !== text(formData, "confirmPassword")) throw new UserError("New passwords do not match.");
    await changeOwnerPassword(owner.id, text(formData, "currentPassword"), text(formData, "password"));
    return "Password changed. Other sessions were signed out.";
  });
}

export async function revokeSessionsAction() {
  const owner = await requireOwner();
  await runFormAction("/admin/settings?tab=security", async () => {
    const count = await revokeOtherSessions(owner.id);
    return count ? `Signed out ${count} other session${count === 1 ? "" : "s"}.` : "No other sessions were active.";
  });
}

export async function startTotpSetupAction() {
  const owner = await requireOwner();
  await runFormAction("/admin/settings?tab=security", async () => {
    if (owner.totpEnabled) throw new UserError("Two-factor authentication is already enabled.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpSecret: generateTotpSecret(), totpEnabled: false } });
    return "Scan the QR code, then enter a code to finish enabling two-factor authentication.";
  });
}

export async function confirmTotpAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings?tab=security", async () => {
    if (!owner.totpSecret) throw new UserError("Start two-factor setup first.");
    if (!verifyTotp(owner.totpSecret, text(formData, "code"))) throw new UserError("That code is not valid. Check your device's clock and try again.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpEnabled: true } });
    await audit("auth.totp_enabled");
    return "Two-factor authentication is enabled.";
  });
}

export async function disableTotpAction(formData: FormData) {
  const owner = await requireOwner();
  await runFormAction("/admin/settings?tab=security", async () => {
    if (!(await verifyOwnerPassword(owner.id, text(formData, "currentPassword")))) throw new AuthError("Your current password is incorrect.");
    await prisma.owner.update({ where: { id: owner.id }, data: { totpEnabled: false, totpSecret: null } });
    await audit("auth.totp_disabled");
    return "Two-factor authentication is disabled.";
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Settings → Page: alias, footer, analytics notice and temporary redirect. */
export async function savePageSettingsAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings?tab=page", async () => {
    const profile = await prisma.profile.findFirstOrThrow();
    const parsed = profileSchema.pick({ slug: true, priorityRedirectUrl: true, priorityRedirectOn: true, cookieNoticeEnabled: true }).parse({
      slug: text(formData, "slug").trim() || profile.slug,
      priorityRedirectUrl: optionalText(formData, "priorityRedirectUrl"),
      priorityRedirectOn: bool(formData.get("priorityRedirectOn")),
      cookieNoticeEnabled: bool(formData.get("cookieNoticeEnabled"))
    });
    if (parsed.priorityRedirectOn && !parsed.priorityRedirectUrl) throw new UserError("Add a redirect URL before turning on the redirect.");
    await prisma.profile.update({ where: { id: profile.id }, data: { ...parsed, priorityRedirectUrl: parsed.priorityRedirectUrl ?? null } });
    const current = await readPlatformSettings();
    await writePlatformSettings({ ...current, footerText: text(formData, "footerText").slice(0, 200) });
    await audit("settings.page_updated");
    refreshPublic();
    return "Page settings saved.";
  });
}

/** Settings → SEO & sharing. */
export async function saveSeoAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings?tab=seo", async () => {
    const profile = await prisma.profile.findFirstOrThrow();
    const upload = await saveUploadedImage(formData.get("ogImageFile"), "profile");
    const parsed = profileSchema.pick({ seoTitle: true, seoDescription: true, ogImageUrl: true, allowIndexing: true }).parse({
      seoTitle: optionalText(formData, "seoTitle"),
      seoDescription: optionalText(formData, "seoDescription"),
      ogImageUrl: bool(formData.get("removeOgImage")) ? undefined : upload || optionalText(formData, "ogImageUrl"),
      allowIndexing: bool(formData.get("allowIndexing"))
    });
    await prisma.profile.update({
      where: { id: profile.id },
      data: { seoTitle: parsed.seoTitle || null, seoDescription: parsed.seoDescription || null, ogImageUrl: parsed.ogImageUrl ?? null, allowIndexing: parsed.allowIndexing }
    });
    await audit("settings.seo_updated");
    refreshPublic();
    return "Search & sharing settings saved.";
  });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

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
  await runFormAction("/admin", async () => {
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
  await runFormAction("/admin", async () => {
    const results = await checkLinkHealth();
    const broken = results.filter((result) => !result.ok).length;
    return broken ? `Checked ${results.length} links: ${broken} may be broken (see the warnings below).` : `Checked ${results.length} links: all reachable.`;
  });
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Short links
// ---------------------------------------------------------------------------

export async function saveShortLinkAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings?tab=short-links", async () => {
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
  await runFormAction("/admin/settings?tab=short-links", async () => {
    const link = await prisma.shortLink.delete({ where: { id: text(formData, "id") } });
    await audit("short_link.deleted", { code: link.code });
    return `Short link /s/${link.code} deleted.`;
  });
}

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Settings, SMTP and integrations
// ---------------------------------------------------------------------------

export type SmtpTestActionState = { ok: boolean; message: string } | null;

/**
 * Settings are edited in separate tabs; each form posts a hidden `section` so only
 * that section's values change (unchecked checkboxes are absent from FormData).
 */
function platformSettingsFromForm(formData: FormData, current: Record<string, unknown>) {
  const section = text(formData, "section");
  const next: Record<string, unknown> = { ...current, storageMode: "local" };
  if (section === "email") {
    const currentSmtp = current.smtp as { password?: string } | undefined;
    const port = Number(text(formData, "smtpPort") || 587);
    next.emailProvider = text(formData, "emailProvider") === "smtp" ? "smtp" : "disabled";
    next.smtp = {
      host: text(formData, "smtpHost").trim().slice(0, 253),
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
      secure: bool(formData.get("smtpSecure")),
      user: text(formData, "smtpUser").slice(0, 200),
      password: bool(formData.get("clearSmtpPassword")) ? "" : text(formData, "smtpPassword") || currentSmtp?.password || "",
      fromName: text(formData, "smtpFromName").slice(0, 80),
      fromEmail: text(formData, "smtpFromEmail").slice(0, 254)
    };
  }
  if (section === "integrations") {
    const currentMeta = current.meta as { facebookAccessToken?: string; instagramAccessToken?: string } | undefined;
    const clear = bool(formData.get("clearMetaTokens"));
    next.meta = {
      enabled: bool(formData.get("metaEnabled")),
      graphVersion: /^v\d+\.\d+$/.test(text(formData, "metaGraphVersion").trim()) ? text(formData, "metaGraphVersion").trim() : "v23.0",
      instagramUserId: text(formData, "metaInstagramUserId").replace(/\D/g, ""),
      instagramAccessToken: clear ? "" : text(formData, "metaInstagramAccessToken").trim() || currentMeta?.instagramAccessToken || "",
      facebookPageId: text(formData, "metaFacebookPageId").replace(/\D/g, ""),
      facebookAccessToken: clear ? "" : text(formData, "metaFacebookAccessToken").trim() || currentMeta?.facebookAccessToken || ""
    };
  }
  return next;
}

export async function saveSettingsAction(formData: FormData) {
  await requireOwner();
  const tab = text(formData, "section") === "email" ? "email" : "integrations";
  await runFormAction(`/admin/settings?tab=${tab}`, async () => {
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
  await runFormAction("/admin/settings?tab=data", async () => {
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
  await runFormAction("/admin/settings?tab=data", async () => {
    const result = await cleanupUnusedUploads();
    await audit("uploads.cleaned", result);
    return result.deleted ? `Removed ${result.deleted} unused file${result.deleted === 1 ? "" : "s"} (${(result.bytes / 1024 / 1024).toFixed(1)}MB).` : "No unused uploads found.";
  });
}

export async function purgeAnalyticsAction(formData: FormData) {
  await requireOwner();
  await runFormAction("/admin/settings?tab=data", async () => {
    const days = Number(text(formData, "olderThanDays"));
    if (![30, 90, 180, 365].includes(days)) throw new UserError("Choose a retention period.");
    const result = await prisma.event.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } });
    await audit("analytics.purged", { days, count: result.count });
    return `Deleted ${result.count} analytics event${result.count === 1 ? "" : "s"} older than ${days} days.`;
  });
}
