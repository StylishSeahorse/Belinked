import { FormRestore } from "@/components/FormRestore";
import { ArrowDown, ArrowUp } from "lucide-react";
import { deleteSocialIconAction, moveSocialIconAction, saveSocialIconAction, saveSocialPlacementAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { readPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { parseSocialPlacement, SocialGlyph, socialPlatforms } from "@/lib/socials";

export const dynamic = "force-dynamic";
export const metadata = { title: "Socials" };

function PlatformSelect({ defaultValue, allowAuto = false }: { defaultValue: string; allowAuto?: boolean }) {
  return (
    <select className="input" name="icon" defaultValue={defaultValue}>
      {allowAuto ? <option value="auto">Detect from URL</option> : null}
      {socialPlatforms.map((platform) => (
        <option key={platform.id} value={platform.id}>
          {platform.label}
        </option>
      ))}
    </select>
  );
}

export default async function SocialsPage() {
  await requireOwner();
  const [socials, platform] = await Promise.all([prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }), readPlatformSettings()]);
  const socialPlacement = parseSocialPlacement(platform.socialPlacement);

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-3xl font-black">Socials</h1>
        <p className="text-sm text-black/60">A row of icons linking to your profiles elsewhere. Email and phone numbers work too.</p>
      </div>

      <form action={saveSocialIconAction} className="panel grid gap-4 md:grid-cols-4">
        <FormRestore id="social-new" />
        <h2 className="text-lg font-black md:col-span-4">Add a social link</h2>
        <label className="field md:col-span-2">
          URL, email, or phone
          <input className="input" name="url" placeholder="https://instagram.com/yourhandle" required />
        </label>
        <label className="field">
          Platform
          <PlatformSelect defaultValue="auto" allowAuto />
        </label>
        <label className="field">
          Label (optional)
          <input className="input" name="label" placeholder="Used for screen readers" maxLength={60} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input className="w-auto" type="checkbox" name="isVisible" defaultChecked /> Visible
        </label>
        <div className="md:col-span-4">
          <SubmitButton pendingLabel="Adding...">Add social link</SubmitButton>
        </div>
      </form>

      <section className="grid gap-3" aria-label="Social links">
        {socials.length ? (
          socials.map((social, index) => (
            <div key={social.id} className="panel grid gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
                  <SocialGlyph social={social} className="h-5 w-5" />
                </span>
                <strong className="min-w-0 flex-1 truncate">{social.label}</strong>
                {!social.isVisible ? <span className="badge bg-slate-400/15 text-slate-300">hidden</span> : null}
                <form action={moveSocialIconAction}>
                  <input type="hidden" name="id" value={social.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className="btn-secondary btn-sm" disabled={index === 0} aria-label={`Move ${social.label} up`}><ArrowUp size={14} aria-hidden="true" /></button>
                </form>
                <form action={moveSocialIconAction}>
                  <input type="hidden" name="id" value={social.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className="btn-secondary btn-sm" disabled={index === socials.length - 1} aria-label={`Move ${social.label} down`}><ArrowDown size={14} aria-hidden="true" /></button>
                </form>
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Edit</summary>
                <form action={saveSocialIconAction} className="mt-3 grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="id" value={social.id} />
                  <label className="field md:col-span-2">URL<input className="input" name="url" defaultValue={social.url} required /></label>
                  <label className="field">Platform<PlatformSelect defaultValue={social.icon} /></label>
                  <label className="field">Label<input className="input" name="label" defaultValue={social.label} maxLength={60} required /></label>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isVisible" defaultChecked={social.isVisible} /> Visible</label>
                  <div className="flex flex-wrap gap-2 md:col-span-4">
                    <SubmitButton>Save</SubmitButton>
                    <ConfirmButton formAction={deleteSocialIconAction} message={`Delete ${social.label}?`}>Delete</ConfirmButton>
                  </div>
                </form>
              </details>
            </div>
          ))
        ) : (
          <div className="panel text-sm text-black/60">No social links yet. Add your first one above.</div>
        )}
      </section>

      <form action={saveSocialPlacementAction} className="panel grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="field">
          Icon row position
          <select className="input" name="socialPlacement" defaultValue={socialPlacement}>
            <option value="top">Above links</option>
            <option value="bottom">Below links</option>
          </select>
        </label>
        <SubmitButton>Save placement</SubmitButton>
      </form>
    </div>
  );
}
