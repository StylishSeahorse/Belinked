import { FormRestore } from "@/components/FormRestore";
import { saveProfileAction } from "@/app/actions";
import { QrDesigner } from "@/components/QrDesigner";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

function MediaField({ label, name, fileName, removeName, value, hint }: { label: string; name: string; fileName: string; removeName: string; value: string | null; hint?: string }) {
  return (
    <div className="field">
      {label}
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-12 w-12 shrink-0 rounded-md bg-white/10 object-cover" />
        ) : null}
        <input className="input" name={fileName} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label={`Upload ${label.toLowerCase()}`} />
      </div>
      <input className="input" name={name} defaultValue={value || ""} placeholder="or paste an https:// image URL" aria-label={`${label} URL`} />
      {value ? (
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/55">
          <input className="w-auto" type="checkbox" name={removeName} /> Remove current image
        </span>
      ) : null}
      {hint ? <span className="text-xs text-black/55">{hint}</span> : null}
    </div>
  );
}

export default async function ProfilePage() {
  await requireOwner();
  const [profile, base] = await Promise.all([prisma.profile.findFirstOrThrow(), siteUrl()]);
  return (
    <div className="grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Profile</h1>
          <p className="text-sm text-black/60">How you appear at the top of your page and when your link is shared.</p>
        </div>
        <a className="btn-secondary" href="/" target="_blank" rel="noopener">Preview page</a>
      </div>
      <form action={saveProfileAction} encType="multipart/form-data" className="grid gap-5">
        <FormRestore id="profile" />
        <section className="panel grid gap-4 md:grid-cols-2">
          <h2 className="text-lg font-black md:col-span-2">Identity</h2>
          <label className="field">Display name<input className="input" name="displayName" defaultValue={profile.displayName} maxLength={80} required /></label>
          <label className="field">Username<input className="input" name="username" defaultValue={profile.username} maxLength={80} required /><span className="text-xs text-black/55">Shown as @username under your name.</span></label>
          <label className="field">Badge<input className="input" name="badge" defaultValue={profile.badge || ""} maxLength={60} placeholder="e.g. New album out now" /></label>
          <label className="field">
            Page alias
            <input className="input" name="slug" defaultValue={profile.slug} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]" minLength={2} maxLength={48} />
            <span className="text-xs text-black/55">/{profile.slug} redirects to your page.</span>
          </label>
          <label className="field md:col-span-2">Bio<textarea className="input" name="bio" rows={3} maxLength={280} defaultValue={profile.bio} /><span className="text-xs text-black/55">Up to 280 characters.</span></label>
          <MediaField label="Profile picture" name="avatarUrl" fileName="avatarFile" removeName="removeAvatar" value={profile.avatarUrl} hint="Square images work best. Shape is set in Appearance." />
          <MediaField label="Logo" name="logoUrl" fileName="logoFile" removeName="removeLogo" value={profile.logoUrl} hint="Optional, shown above your picture and used as the favicon." />
        </section>

        <section className="panel grid gap-4 md:grid-cols-2">
          <h2 className="text-lg font-black md:col-span-2">Search and sharing</h2>
          <label className="field">SEO title<input className="input" name="seoTitle" defaultValue={profile.seoTitle || ""} maxLength={100} placeholder={profile.displayName} /></label>
          <MediaField label="Share image" name="ogImageUrl" fileName="ogImageFile" removeName="removeOgImage" value={profile.ogImageUrl} hint="1200×630 recommended. Falls back to your profile picture." />
          <label className="field md:col-span-2">SEO description<textarea className="input" name="seoDescription" rows={2} maxLength={180} defaultValue={profile.seoDescription || ""} placeholder={profile.bio} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
            <input className="w-auto" type="checkbox" name="allowIndexing" defaultChecked={profile.allowIndexing} /> Allow search engines to index my page
          </label>
        </section>

        <section className="panel grid gap-4">
          <h2 className="text-lg font-black">Visibility</h2>
          <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isPublished" defaultChecked={profile.isPublished} /> Published (visitors can see the page)</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="cookieNoticeEnabled" defaultChecked={profile.cookieNoticeEnabled} /> Show analytics disclosure in the footer</label>
          <div className="grid gap-2 rounded-md border border-black/10 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="priorityRedirectOn" defaultChecked={profile.priorityRedirectOn} /> Temporarily send all visitors to another URL</label>
            <label className="field">Redirect URL<input className="input" name="priorityRedirectUrl" type="url" defaultValue={profile.priorityRedirectUrl || ""} placeholder="https://example.com/launch" /></label>
            <span className="text-xs text-black/55">Useful for a launch or live stream. You still see your normal page while signed in.</span>
          </div>
        </section>
        <div><SubmitButton>Save profile</SubmitButton></div>
      </form>

      <section className="panel grid gap-3">
        <h2 className="text-lg font-black">QR code</h2>
        <QrDesigner target={`${base}/`} />
      </section>
    </div>
  );
}
