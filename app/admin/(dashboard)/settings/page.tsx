import { ExternalLink } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { Suspense, type ReactNode } from "react";
import {
  changePasswordAction,
  cleanupUploadsAction,
  confirmTotpAction,
  deleteShortLinkAction,
  disableTotpAction,
  purgeAnalyticsAction,
  restoreBackupAction,
  revokeSessionsAction,
  savePageSettingsAction,
  saveSeoAction,
  saveSettingsAction,
  saveShortLinkAction,
  startTotpSetupAction
} from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DateTimeField } from "@/components/DateTimeField";
import { FlashMessage } from "@/components/FlashMessage";
import { FormRestore } from "@/components/FormRestore";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { readPlatformSettings, redactPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { totpUri } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const TABS = [
  ["page", "Page"],
  ["seo", "SEO & sharing"],
  ["domain", "Domain"],
  ["integrations", "Analytics & integrations"],
  ["email", "Email"],
  ["short-links", "Short links"],
  ["security", "Security"],
  ["data", "Data & backups"]
] as const;
type Tab = (typeof TABS)[number][0];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="panel grid gap-5">
      <div>
        <h2 className="text-lg font-black">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-[var(--ui-border)] p-3">
      <input className="mt-1 h-4 w-4 accent-[var(--ui-accent)]" type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const owner = await requireOwner();
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.some(([id]) => id === requested) ? (requested as Tab) : "page";
  const [profile, settings, base] = await Promise.all([prisma.profile.findFirstOrThrow(), readPlatformSettings(), siteUrl()]);
  const platform = redactPlatformSettings(settings);
  const meta = (platform.meta || {}) as Record<string, unknown>;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-8">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-sm text-muted">Technical options for your page. Everyday editing lives in Links and Appearance.</p>
      </div>
      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:px-0">
        <ul className="flex gap-1 lg:grid lg:content-start">
          {TABS.map(([id, label]) => (
            <li key={id}>
              <Link
                href={`/admin/settings?tab=${id}`}
                aria-current={tab === id ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition lg:rounded-xl ${tab === id ? "bg-white text-[var(--ui-ink)] shadow-sm ring-1 ring-[var(--ui-border)]" : "text-muted hover:bg-white/60"}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid min-w-0 content-start gap-6">
        <Suspense fallback={null}>
          <FlashMessage />
        </Suspense>

        {tab === "page" ? (
          <Section title="Page" description="Your public address and page-wide options.">
            <form action={savePageSettingsAction} className="grid gap-4">
              <FormRestore id="settings-page" />
              <div className="field">
                Public address
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f6f6f3] px-3.5 py-2.5 text-sm font-normal">
                  <span className="min-w-0 flex-1 truncate font-semibold">{base}/</span>
                  <a className="btn-ghost btn-sm" href={`${base}/`} target="_blank" rel="noopener">
                    <ExternalLink size={14} aria-hidden="true" /> Open
                  </a>
                </div>
                <span className="field-hint">Change it on the Domain tab.</span>
              </div>
              <label className="field">
                Short alias
                <span className="flex items-center rounded-xl border border-[var(--ui-border-strong)] bg-white pl-3.5 focus-within:border-[var(--ui-accent)]">
                  <span className="text-sm font-normal text-muted">{base.replace(/^https?:\/\//, "")}/</span>
                  <input className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm font-normal outline-none" name="slug" defaultValue={profile.slug} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]" minLength={2} maxLength={48} />
                </span>
                <span className="field-hint">Also takes visitors to your page, which is handy for printed material.</span>
              </label>
              <label className="field">
                Footer text
                <input className="input" name="footerText" defaultValue={typeof settings.footerText === "string" ? settings.footerText : ""} maxLength={200} placeholder="© 2026 Your Name" />
              </label>
              <Toggle name="cookieNoticeEnabled" label="Show a privacy note in the footer" hint="Tells visitors the page uses cookie-free, first-party analytics." defaultChecked={profile.cookieNoticeEnabled} />
              <div className="grid gap-3 rounded-2xl border border-[var(--ui-border)] p-3">
                <Toggle name="priorityRedirectOn" label="Temporarily send visitors somewhere else" hint="For a launch or live stream. You still see your normal page while signed in." defaultChecked={profile.priorityRedirectOn} />
                <label className="field">
                  Redirect to
                  <input className="input" name="priorityRedirectUrl" type="url" defaultValue={profile.priorityRedirectUrl || ""} placeholder="https://example.com/launch" />
                </label>
              </div>
              <div>
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </Section>
        ) : null}

        {tab === "seo" ? (
          <Section title="SEO & sharing" description="How your page appears in search results and when your link is shared.">
            <form action={saveSeoAction} encType="multipart/form-data" className="grid gap-4">
              <FormRestore id="settings-seo" />
              <label className="field">
                Page title
                <input className="input" name="seoTitle" defaultValue={profile.seoTitle || ""} maxLength={100} placeholder={profile.displayName} />
              </label>
              <label className="field">
                Description
                <textarea className="input" name="seoDescription" rows={2} maxLength={180} defaultValue={profile.seoDescription || ""} placeholder={profile.bio} />
              </label>
              <div className="field">
                Share image
                <div className="flex flex-wrap items-center gap-3">
                  {profile.ogImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.ogImageUrl} alt="" className="h-16 w-28 rounded-lg object-cover" />
                  ) : null}
                  <input className="input max-w-xs" name="ogImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload share image" />
                </div>
                <input className="input" name="ogImageUrl" defaultValue={profile.ogImageUrl || ""} placeholder="or an https:// image URL" aria-label="Share image URL" />
                {profile.ogImageUrl ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                    <input className="w-auto" type="checkbox" name="removeOgImage" /> Remove share image
                  </span>
                ) : null}
                <span className="field-hint">1200×630 works best. If empty, your profile picture is used.</span>
              </div>
              <Toggle name="allowIndexing" label="Let search engines list my page" defaultChecked={profile.allowIndexing} />
              <div>
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </Section>
        ) : null}

        {tab === "domain" ? (
          <Section title="Domain" description="Belinked is self-hosted, so your domain is configured where the app runs.">
            <div className="grid gap-3 text-sm">
              <p>
                Current public address: <strong>{base}/</strong>
              </p>
              <ol className="grid list-decimal gap-2 pl-5 text-muted">
                <li>Point your domain’s DNS (an A/AAAA record or CNAME) at your server or reverse proxy.</li>
                <li>Serve it over HTTPS (for example with Caddy, Traefik or Cloudflare).</li>
                <li>
                  Set <code className="rounded bg-[#f1f1ee] px-1">APP_URL=https://your.domain</code> and <code className="rounded bg-[#f1f1ee] px-1">COOKIE_SECURE=true</code>, then restart the app.
                </li>
              </ol>
              <p className="text-muted">Your share link, QR code, canonical URL, sitemap and social previews all follow APP_URL automatically.</p>
            </div>
          </Section>
        ) : null}

        {tab === "integrations" ? (
          <>
            <Section title="Analytics" description="Built-in, cookie-free analytics are always on. Your own visits are never counted.">
              <form action={purgeAnalyticsAction} className="flex flex-wrap items-end gap-3">
                <label className="field">
                  Delete analytics older than
                  <select className="input" name="olderThanDays" defaultValue="365">
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </label>
                <ConfirmButton message="Permanently delete older analytics?" pendingLabel="Deleting…">
                  Delete old data
                </ConfirmButton>
              </form>
            </Section>
            <Section title="Instagram & Facebook stats" description="Optionally show follower counts and your latest post. Needs Meta Graph API access; tokens stay on the server.">
              <form action={saveSettingsAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="section" value="integrations" />
                <div className="md:col-span-2">
                  <Toggle name="metaEnabled" label="Show social stats on my page" defaultChecked={Boolean(meta.enabled)} />
                </div>
                <label className="field">
                  Instagram user ID
                  <input className="input" name="metaInstagramUserId" defaultValue={String(meta.instagramUserId || "")} />
                </label>
                <label className="field">
                  Instagram access token
                  <input className="input" name="metaInstagramAccessToken" type="password" autoComplete="off" placeholder={meta.instagramAccessToken ? "Saved. Leave blank to keep it." : ""} />
                </label>
                <label className="field">
                  Facebook Page ID
                  <input className="input" name="metaFacebookPageId" defaultValue={String(meta.facebookPageId || "")} />
                </label>
                <label className="field">
                  Facebook Page token
                  <input className="input" name="metaFacebookAccessToken" type="password" autoComplete="off" placeholder={meta.facebookAccessToken ? "Saved. Leave blank to keep it." : ""} />
                </label>
                <label className="field">
                  Graph API version
                  <input className="input" name="metaGraphVersion" defaultValue={String(meta.graphVersion || "v23.0")} />
                </label>
                {meta.instagramAccessToken || meta.facebookAccessToken ? (
                  <label className="flex items-center gap-2 self-end text-sm font-semibold">
                    <input className="w-auto" type="checkbox" name="clearMetaTokens" /> Forget saved tokens
                  </label>
                ) : null}
                <div className="md:col-span-2">
                  <SubmitButton>Save</SubmitButton>
                </div>
              </form>
            </Section>
          </>
        ) : null}

        {tab === "email" ? (
          <Section title="Email" description="Connect an SMTP server (optional).">
            <SmtpSettingsForm platform={platform} smtp={(platform.smtp || {}) as Record<string, unknown>} />
          </Section>
        ) : null}

        {tab === "short-links" ? <ShortLinks base={base} /> : null}
        {tab === "security" ? <Security owner={owner} /> : null}
        {tab === "data" ? <DataTab /> : null}
      </div>
    </div>
  );
}

async function ShortLinks({ base }: { base: string }) {
  const [links, clicks] = await Promise.all([
    prisma.shortLink.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.event.groupBy({ by: ["shortCode"], where: { type: "SHORT_LINK_CLICK", isBot: false }, _count: { _all: true } })
  ]);
  const clickCount = new Map(clicks.map((row) => [row.shortCode, row._count._all]));
  const host = base.replace(/^https?:\/\//, "");
  return (
    <Section title="Short links" description={`Memorable, trackable redirects like ${host}/s/tour for posters, podcasts and bios.`}>
      <form action={saveShortLinkAction} className="grid gap-3 rounded-2xl bg-[#f7f7f5] p-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
        <FormRestore id="short-new" />
        <input type="hidden" name="isActive" value="on" />
        <label className="field">
          Short code
          <span className="flex items-center rounded-xl border border-[var(--ui-border-strong)] bg-white pl-3 focus-within:border-[var(--ui-accent)]">
            <span className="text-sm font-normal text-muted">/s/</span>
            <input className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm font-normal outline-none" name="code" placeholder="tour" pattern="[a-zA-Z0-9_\-]{2,40}" required aria-label="Code" />
          </span>
        </label>
        <label className="field">
          Goes to
          <input className="input" name="destination" type="url" placeholder="https://example.com" required aria-label="Destination" />
        </label>
        <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
      </form>
      {links.length ? (
        <ul className="grid gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <details className="rounded-2xl border border-[var(--ui-border)] bg-white">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3">
                  <span className="font-mono text-sm font-bold">/s/{link.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{link.destination}</span>
                  <span className="badge badge-muted">{clickCount.get(link.code) || 0} clicks</span>
                  {!link.isActive ? <span className="badge badge-muted">Off</span> : null}
                </summary>
                <form action={saveShortLinkAction} className="grid gap-3 border-t border-[var(--ui-border)] p-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={link.id} />
                  <label className="field">Code<input className="input" name="code" defaultValue={link.code} pattern="[a-zA-Z0-9_\-]{2,40}" required /></label>
                  <label className="field">Goes to<input className="input" name="destination" type="url" defaultValue={link.destination} required /></label>
                  <label className="field md:col-span-2">Note<input className="input" name="description" defaultValue={link.description || ""} maxLength={160} /></label>
                  <DateTimeField name="startsAt" label="Active from" defaultValue={link.startsAt?.toISOString()} />
                  <DateTimeField name="endsAt" label="Expires" defaultValue={link.endsAt?.toISOString()} />
                  <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isActive" defaultChecked={link.isActive} /> Active</label>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <SubmitButton>Save</SubmitButton>
                    <a className="btn-secondary" href={`/s/${link.code}`} target="_blank" rel="noopener">Test</a>
                    <ConfirmButton formAction={deleteShortLinkAction} message={`Delete /s/${link.code}? Anyone using it will see a "not found" page.`}>Delete</ConfirmButton>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-[var(--ui-border-strong)] p-6 text-center text-sm text-muted">No short links yet. Create one above.</p>
      )}
    </Section>
  );
}

async function Security({ owner }: { owner: Awaited<ReturnType<typeof requireOwner>> }) {
  const sessionCount = await prisma.session.count({ where: { ownerId: owner.id, expiresAt: { gt: new Date() } } });
  const pendingTotp = !owner.totpEnabled && owner.totpSecret ? owner.totpSecret : null;
  const totpQr = pendingTotp ? await QRCode.toDataURL(totpUri(pendingTotp, owner.email), { margin: 1, width: 220 }) : null;
  const recent = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  return (
    <>
      <Section title="Password" description={`Signed in as ${owner.email}.`}>
        <form action={changePasswordAction} className="grid gap-3 md:grid-cols-3">
          <input type="text" name="username" autoComplete="username" defaultValue={owner.email} hidden readOnly />
          <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field">New password<input className="input" name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
          <label className="field">Confirm new password<input className="input" name="confirmPassword" type="password" minLength={12} autoComplete="new-password" required /></label>
          <div className="md:col-span-3"><SubmitButton pendingLabel="Changing…">Change password</SubmitButton></div>
        </form>
      </Section>
      <Section title="Two-factor authentication" description="Require a code from an authenticator app when signing in.">
        {owner.totpEnabled ? (
          <form action={disableTotpAction} className="flex flex-wrap items-end gap-3">
            <p className="w-full text-sm font-semibold text-[var(--ui-success)]">On. Sign-in asks for a 6-digit code.</p>
            <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <ConfirmButton message="Turn off two-factor authentication?">Turn off</ConfirmButton>
          </form>
        ) : pendingTotp && totpQr ? (
          <form action={confirmTotpAction} className="grid gap-4 md:grid-cols-[200px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totpQr} alt="QR code for your authenticator app" className="rounded-2xl border border-[var(--ui-border)] bg-white p-2" width={200} height={200} />
            <div className="grid content-start gap-3">
              <p className="text-sm text-muted">Scan with 1Password, Aegis, Google Authenticator or similar, or enter this key:</p>
              <code className="break-all rounded-xl bg-[#f1f1ee] p-2 text-sm">{pendingTotp}</code>
              <label className="field">6-digit code<input className="input tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required /></label>
              <div><SubmitButton pendingLabel="Verifying…">Turn on</SubmitButton></div>
            </div>
          </form>
        ) : (
          <form action={startTotpSetupAction}>
            <SubmitButton className="btn-secondary">Set up two-factor</SubmitButton>
          </form>
        )}
      </Section>
      <Section title="Sessions" description={`${sessionCount} active session${sessionCount === 1 ? "" : "s"}, including this one. Sessions last 14 days.`}>
        <form action={revokeSessionsAction}>
          <SubmitButton className="btn-secondary" pendingLabel="Signing out…">Sign out everywhere else</SubmitButton>
        </form>
      </Section>
      <Section title="Recent activity">
        <ul className="grid gap-1 text-sm">
          {recent.map((log) => (
            <li key={log.id} className="flex justify-between gap-3 border-b border-[var(--ui-border)] py-2 last:border-0">
              <span>{log.action.replaceAll("_", " ").replaceAll(".", " · ")}</span>
              <time className="shrink-0 tabular-nums text-muted" dateTime={log.createdAt.toISOString()}>{log.createdAt.toISOString().replace("T", " ").slice(0, 16)}</time>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

async function DataTab() {
  const [blocks, events, subscribers] = await Promise.all([prisma.block.count(), prisma.event.count(), prisma.subscriber.count()]);
  return (
    <>
      <Section title="Export" description={`${blocks} blocks · ${events} analytics events · ${subscribers} subscribers. Backups never include your password or API secrets.`}>
        <div className="flex flex-wrap gap-2">
          <a className="btn" download href="/api/export?type=all">Download backup</a>
          <a className="btn-secondary" download href="/api/export?type=all&analytics=1">Backup incl. analytics</a>
          <a className="btn-secondary" download href="/api/export?type=subscribers&format=csv">Subscribers (CSV)</a>
          <a className="btn-secondary" download href="/api/export?type=links&format=csv">Links (CSV)</a>
        </div>
        <p className="text-xs text-muted">For full disaster recovery, also copy the database file and uploads folder on the server (see README).</p>
      </Section>
      <Section title="Restore a backup" description="Replaces your links, blocks, social icons and short links, and updates your profile, themes and settings. Your password, 2FA and analytics are kept.">
        <form action={restoreBackupAction} encType="multipart/form-data" className="grid gap-3 md:grid-cols-2">
          <label className="field md:col-span-2">Backup file<input className="input" name="backupFile" type="file" accept="application/json,.json" required /></label>
          <label className="field">Current password<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field">Type RESTORE to confirm<input className="input" name="confirm" autoComplete="off" required pattern="RESTORE" /></label>
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input className="w-auto" type="checkbox" name="includeSubscribers" /> Also replace subscribers</label>
          <div className="md:col-span-2"><ConfirmButton message="Replace your current content with this backup?" pendingLabel="Restoring…">Restore backup</ConfirmButton></div>
        </form>
      </Section>
      <Section title="Storage" description="Remove uploaded files that nothing uses any more.">
        <form action={cleanupUploadsAction}>
          <ConfirmButton className="btn-secondary" message="Delete uploaded files that are no longer used?" pendingLabel="Cleaning…">Clean up unused uploads</ConfirmButton>
        </form>
      </Section>
    </>
  );
}
