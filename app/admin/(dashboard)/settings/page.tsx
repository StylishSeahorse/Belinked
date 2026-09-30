import QRCode from "qrcode";
import {
  changePasswordAction,
  cleanupUploadsAction,
  confirmTotpAction,
  disableTotpAction,
  purgeAnalyticsAction,
  restoreBackupAction,
  revokeSessionsAction,
  startTotpSetupAction
} from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { readPlatformSettings, redactPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { totpUri } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const owner = await requireOwner();
  const [settings, auditLogs, sessionCount, counts] = await Promise.all([
    readPlatformSettings(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.session.count({ where: { ownerId: owner.id, expiresAt: { gt: new Date() } } }),
    Promise.all([prisma.block.count(), prisma.event.count(), prisma.subscriber.count()])
  ]);
  // Secrets never leave the server: the form only learns whether one is set.
  const platform = redactPlatformSettings(settings);
  const smtp = (platform.smtp || {}) as Record<string, unknown>;
  const pendingTotp = !owner.totpEnabled && owner.totpSecret ? owner.totpSecret : null;
  const totpQr = pendingTotp ? await QRCode.toDataURL(totpUri(pendingTotp, owner.email), { margin: 1, width: 220 }) : null;

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-3xl font-black">Settings</h1>

      <SmtpSettingsForm platform={platform} smtp={smtp} />

      <section id="security" className="panel grid scroll-mt-6 gap-5">
        <h2 className="text-xl font-black">Security</h2>

        <form action={changePasswordAction} className="grid gap-3 md:grid-cols-3">
          <h3 className="font-bold md:col-span-3">Change password</h3>
          <input type="text" name="username" autoComplete="username" defaultValue={owner.email} hidden readOnly />
          <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field">New password<input className="input" name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
          <label className="field">Confirm new password<input className="input" name="confirmPassword" type="password" minLength={12} autoComplete="new-password" required /></label>
          <div className="md:col-span-3"><SubmitButton pendingLabel="Changing...">Change password</SubmitButton></div>
        </form>

        <div className="grid gap-3 border-t border-black/10 pt-4">
          <h3 className="font-bold">Two-factor authentication</h3>
          {owner.totpEnabled ? (
            <form action={disableTotpAction} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <p className="text-sm text-emerald-200 md:col-span-2">Enabled. Sign-in requires a code from your authenticator app.</p>
              <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <ConfirmButton message="Turn off two-factor authentication?">Disable 2FA</ConfirmButton>
            </form>
          ) : pendingTotp && totpQr ? (
            <form action={confirmTotpAction} className="grid gap-3 md:grid-cols-[220px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totpQr} alt="QR code for your authenticator app" className="rounded-md bg-white p-2" width={220} height={220} />
              <div className="grid content-start gap-3">
                <p className="text-sm text-black/60">Scan with an authenticator app (1Password, Aegis, Google Authenticator...). Or enter this key manually:</p>
                <code className="break-all rounded bg-black/30 p-2 text-sm">{pendingTotp}</code>
                <label className="field">6-digit code<input className="input tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required /></label>
                <SubmitButton pendingLabel="Verifying...">Enable 2FA</SubmitButton>
              </div>
            </form>
          ) : (
            <form action={startTotpSetupAction} className="grid gap-2">
              <p className="text-sm text-black/60">Add a second step to sign-in using an authenticator app.</p>
              <div><SubmitButton className="btn-secondary">Set up 2FA</SubmitButton></div>
            </form>
          )}
        </div>

        <form action={revokeSessionsAction} className="grid gap-2 border-t border-black/10 pt-4">
          <h3 className="font-bold">Sessions</h3>
          <p className="text-sm text-black/60">{sessionCount} active session{sessionCount === 1 ? "" : "s"} (including this one). Sessions expire after 14 days.</p>
          <div><SubmitButton className="btn-secondary" pendingLabel="Signing out...">Sign out all other sessions</SubmitButton></div>
        </form>
      </section>

      <section id="data" className="panel grid scroll-mt-6 gap-5">
        <h2 className="text-xl font-black">Data &amp; backups</h2>
        <div className="grid gap-2">
          <h3 className="font-bold">Export</h3>
          <p className="text-sm text-black/60">
            {counts[0]} blocks, {counts[1]} analytics events, {counts[2]} subscribers. Backups exclude your password and API secrets.
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" download href="/api/export?type=all">Download backup (JSON)</a>
            <a className="btn-secondary" download href="/api/export?type=all&analytics=1">Backup incl. analytics</a>
            <a className="btn-secondary" download href="/api/export?type=subscribers&format=csv">Subscribers (CSV)</a>
            <a className="btn-secondary" download href="/api/export?type=analytics&format=csv">Analytics (CSV)</a>
          </div>
          <p className="text-xs text-black/55">For a complete server backup, also copy the SQLite database file and the uploads folder (see README).</p>
        </div>

        <form action={restoreBackupAction} encType="multipart/form-data" className="grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2">
          <h3 className="font-bold md:col-span-2">Restore from backup</h3>
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100 md:col-span-2">
            Replaces all blocks, social links and short links, and updates your profile, themes and settings. Your password, 2FA and analytics are not changed. Download a fresh backup first.
          </p>
          <label className="field md:col-span-2">Backup file<input className="input" name="backupFile" type="file" accept="application/json,.json" required /></label>
          <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field">Type RESTORE to confirm<input className="input" name="confirm" autoComplete="off" required pattern="RESTORE" /></label>
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input className="w-auto" type="checkbox" name="includeSubscribers" /> Also replace subscribers</label>
          <div className="md:col-span-2"><ConfirmButton message="Replace your current content with this backup?" pendingLabel="Restoring...">Restore backup</ConfirmButton></div>
        </form>

        <div className="grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2">
          <form action={cleanupUploadsAction} className="grid content-start gap-2">
            <h3 className="font-bold">Unused uploads</h3>
            <p className="text-sm text-black/60">Deletes uploaded files that no profile, block or theme uses any more.</p>
            <div><ConfirmButton className="btn-secondary" message="Delete uploaded files that are no longer used?" pendingLabel="Cleaning...">Clean up uploads</ConfirmButton></div>
          </form>
          <form action={purgeAnalyticsAction} className="grid content-start gap-2">
            <h3 className="font-bold">Analytics retention</h3>
            <label className="field">
              Delete events older than
              <select className="input" name="olderThanDays" defaultValue="365">
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </label>
            <div><ConfirmButton message="Permanently delete older analytics events?" pendingLabel="Deleting...">Delete old events</ConfirmButton></div>
          </form>
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-xl font-black">Recent activity</h2>
        <ul className="grid gap-1 text-sm">
          {auditLogs.map((log) => (
            <li key={log.id} className="flex justify-between gap-3 border-b border-black/10 py-2">
              <span>{log.action.replaceAll("_", " ").replaceAll(".", " · ")}</span>
              <time className="shrink-0 text-black/55" dateTime={log.createdAt.toISOString()}>{log.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
