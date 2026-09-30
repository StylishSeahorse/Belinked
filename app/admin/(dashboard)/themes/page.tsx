import Link from "next/link";
import { deleteThemeAction, installStarterThemesAction, selectThemeAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeEditor } from "@/components/ThemeEditor";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicBlocks, publicSocials, toPublicProfile } from "@/lib/public-data";
import { defaultThemes, parseTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appearance" };

export default async function ThemesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const [themes, profile, blocks, socials] = await Promise.all([
    prisma.theme.findMany({ orderBy: { name: "asc" } }),
    prisma.profile.findFirstOrThrow(),
    prisma.block.findMany({ where: { status: "ACTIVE" }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 12 }),
    prisma.socialIcon.findMany({ where: { isVisible: true }, orderBy: { position: "asc" } })
  ]);
  const preview = {
    profile: toPublicProfile(profile),
    blocks: publicBlocks(blocks).filter((block) => block.type !== "SUBSCRIBER_FORM").slice(0, 6),
    socials: publicSocials(socials)
  };
  const editing = params.edit === "new" ? null : themes.find((theme) => theme.id === (params.edit || profile.themeId)) || null;
  const creating = params.edit === "new";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Appearance</h1>
          <p className="text-sm text-black/60">Pick a theme, then fine-tune it. Changes appear on your page as soon as you save.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/admin/themes?edit=new#editor">New theme</Link>
          {themes.length < defaultThemes.length ? (
            <form action={installStarterThemesAction}>
              <SubmitButton className="btn-secondary" pendingLabel="Installing...">Install starter themes</SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <section aria-label="Themes" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {themes.map((theme) => {
          const settings = parseTheme(theme.settings);
          const selected = profile.themeId === theme.id;
          return (
            <div key={theme.id} className={`panel grid gap-2 p-3 ${selected ? "ring-2 ring-cyan-300/60" : ""}`}>
              <div className="grid h-24 content-center gap-1.5 rounded-md bg-cover bg-center p-3" style={{ background: settings.background }}>
                {[0, 1].map((index) => (
                  <div key={index} className="h-5" style={{ background: settings.buttonFill === "outline" ? "transparent" : settings.buttonBackground, border: `${settings.buttonBorderWidth}px solid ${settings.buttonBorder}`, borderRadius: settings.radius }} />
                ))}
              </div>
              <strong className="truncate text-sm">{theme.name}</strong>
              <div className="flex flex-wrap gap-1.5">
                {selected ? (
                  <span className="badge bg-cyan-400/15 text-cyan-200">In use</span>
                ) : (
                  <form action={selectThemeAction}>
                    <input type="hidden" name="themeId" value={theme.id} />
                    <SubmitButton className="btn-secondary btn-sm" pendingLabel="...">Use</SubmitButton>
                  </form>
                )}
                <Link className="btn-secondary btn-sm" href={`/admin/themes?edit=${theme.id}#editor`}>Edit</Link>
                {!selected ? (
                  <form action={deleteThemeAction}>
                    <input type="hidden" name="id" value={theme.id} />
                    <ConfirmButton className="btn-danger btn-sm" message={`Delete the theme "${theme.name}"?`}>Delete</ConfirmButton>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section id="editor" className="grid gap-3 scroll-mt-6">
        <h2 className="text-2xl font-black">{creating ? "New theme" : editing ? `Editing “${editing.name}”` : "Create a theme"}</h2>
        <ThemeEditor
          key={creating ? "new" : editing?.id || "new"}
          id={creating ? undefined : editing?.id}
          name={creating ? "" : editing?.name}
          initial={parseTheme(creating ? null : editing?.settings)}
          preview={preview}
        />
      </section>
    </div>
  );
}
