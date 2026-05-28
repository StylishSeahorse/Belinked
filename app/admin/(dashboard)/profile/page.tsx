import { saveProfileAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireOwner();
  const profile = await prisma.profile.findFirstOrThrow();
  return (
    <form action={saveProfileAction} encType="multipart/form-data" className="grid max-w-3xl gap-5">
      <h1 className="text-3xl font-black">Profile</h1>
      <div className="panel grid gap-4 md:grid-cols-2">
        <input type="hidden" name="slug" value={profile.slug} />
        <label className="field">Display name<input className="input" name="displayName" defaultValue={profile.displayName} /></label>
        <label className="field">Username<input className="input" name="username" defaultValue={profile.username} /></label>
        <label className="field">Badge<input className="input" name="badge" defaultValue={profile.badge || ""} /></label>
        <label className="field md:col-span-2">Bio<textarea className="input" name="bio" rows={3} defaultValue={profile.bio} /></label>
        <div className="field">
          Avatar
          <input className="input" name="avatarUrl" defaultValue={profile.avatarUrl || ""} placeholder="https://example.com/avatar.png or /uploads/..." />
          <input className="input" name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          {profile.avatarUrl ? <span className="text-xs text-black/55">Current: {profile.avatarUrl}</span> : null}
        </div>
        <div className="field">
          Logo
          <input className="input" name="logoUrl" defaultValue={profile.logoUrl || ""} placeholder="https://example.com/logo.png or /uploads/..." />
          <input className="input" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          {profile.logoUrl ? <span className="text-xs text-black/55">Current: {profile.logoUrl}</span> : null}
        </div>
        <label className="field">SEO title<input className="input" name="seoTitle" defaultValue={profile.seoTitle || ""} /></label>
        <div className="field">
          Open Graph image
          <input className="input" name="ogImageUrl" defaultValue={profile.ogImageUrl || ""} placeholder="https://example.com/share.png or /uploads/..." />
          <input className="input" name="ogImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          {profile.ogImageUrl ? <span className="text-xs text-black/55">Current: {profile.ogImageUrl}</span> : null}
        </div>
        <label className="field md:col-span-2">SEO description<textarea className="input" name="seoDescription" rows={2} defaultValue={profile.seoDescription || ""} /></label>
        <label className="field md:col-span-2">Priority redirect URL<input className="input" name="priorityRedirectUrl" defaultValue={profile.priorityRedirectUrl || ""} /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isPublished" defaultChecked={profile.isPublished} /> Published</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="cookieNoticeEnabled" defaultChecked={profile.cookieNoticeEnabled} /> Cookie disclosure</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="priorityRedirectOn" defaultChecked={profile.priorityRedirectOn} /> Redirect whole profile</label>
      </div>
      <div className="flex gap-3"><SubmitButton /><Link className="btn-secondary" href="/api/qr">Download QR</Link></div>
    </form>
  );
}
