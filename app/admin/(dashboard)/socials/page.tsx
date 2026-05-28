import { deleteSocialIconAction, saveSocialIconAction, saveSocialPlacementAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSocialPlacement, socialIconOptions, SocialGlyph } from "@/lib/socials";

export const dynamic = "force-dynamic";

function parse(value?: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export default async function SocialsPage() {
  await requireOwner();
  const [socials, setting] = await Promise.all([
    prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.appSetting.findUnique({ where: { key: "platform" } })
  ]);
  const platform = parse(setting?.value);
  const socialPlacement = parseSocialPlacement(platform.socialPlacement);

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-3xl font-black">Socials</h1>

      <form action={saveSocialPlacementAction} className="panel grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <strong className="text-lg">Placement</strong>
          <p className="text-sm text-black/60">Choose whether the social icon row appears above the links or below them on the public page.</p>
        </div>
        <div className="grid gap-3">
          <label className="field">
            Social row position
            <select className="input" name="socialPlacement" defaultValue={socialPlacement}>
              <option value="top">Top of links</option>
              <option value="bottom">Bottom of links</option>
            </select>
          </label>
          <SubmitButton>Save placement</SubmitButton>
        </div>
      </form>

      <form action={saveSocialIconAction} className="panel grid gap-4 md:grid-cols-4">
        <label className="field">
          Platform
          <select className="input" name="icon" defaultValue="instagram">
            {socialIconOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Label
          <input className="input" name="label" placeholder="Instagram" required />
        </label>
        <label className="field md:col-span-2">
          URL
          <input className="input" name="url" placeholder="https://instagram.com/yourhandle" required />
        </label>
        <label className="field">
          Position
          <input className="input" name="position" type="number" defaultValue={socials.length + 1} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input className="w-auto" type="checkbox" name="isVisible" defaultChecked /> Visible
        </label>
        <div className="md:col-span-4">
          <SubmitButton>Add social link</SubmitButton>
        </div>
      </form>

      <section className="grid gap-3">
        {socials.length ? (
          socials.map((social) => (
            <form key={social.id} action={saveSocialIconAction} className="panel grid gap-4 md:grid-cols-4">
              <input type="hidden" name="id" value={social.id} />
              <div className="field">
                Preview
                <div className="flex h-11 items-center justify-center rounded-md border border-black/10 bg-black/[.03]">
                  <SocialGlyph social={social} />
                </div>
              </div>
              <label className="field">
                Platform
                <select className="input" name="icon" defaultValue={social.icon}>
                  {socialIconOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Label
                <input className="input" name="label" defaultValue={social.label} required />
              </label>
              <label className="field">
                Position
                <input className="input" name="position" type="number" defaultValue={social.position} />
              </label>
              <label className="field md:col-span-3">
                URL
                <input className="input" name="url" defaultValue={social.url} required />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input className="w-auto" type="checkbox" name="isVisible" defaultChecked={social.isVisible} /> Visible
              </label>
              <div className="flex gap-2 md:col-span-4">
                <SubmitButton>Save social</SubmitButton>
                <button className="btn-secondary" formAction={deleteSocialIconAction}>Delete</button>
              </div>
            </form>
          ))
        ) : (
          <div className="panel text-sm text-black/60">No social links yet. Add your first one above.</div>
        )}
      </section>
    </div>
  );
}
