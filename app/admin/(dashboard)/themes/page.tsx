import { installStarterThemesAction, saveThemeAction, selectThemeAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  await requireOwner();
  const [themes, profile] = await Promise.all([prisma.theme.findMany({ orderBy: { name: "asc" } }), prisma.profile.findFirstOrThrow()]);
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-black">Themes</h1>
      <form action={installStarterThemesAction}>
        <button className="btn-secondary">Install or refresh starter themes</button>
      </form>
      <div className="grid gap-4 md:grid-cols-3">
        {themes.map((theme) => {
          const settings = parseTheme(theme.settings);
          return (
            <div key={theme.id} className="panel grid gap-3">
              <div
                className="h-24 rounded-md bg-cover bg-center p-3"
                style={{ background: settings.background, backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined, color: settings.foreground }}
              >
                <div className="h-8 rounded" style={{ background: settings.buttonBackground }} />
              </div>
              <strong>{theme.name}</strong>
              <form action={selectThemeAction}>
                <input type="hidden" name="themeId" value={theme.id} />
                <button className={profile.themeId === theme.id ? "btn" : "btn-secondary"}>{profile.themeId === theme.id ? "Selected" : "Use theme"}</button>
              </form>
              <details className="rounded-md border border-black/10 p-3">
                <summary className="cursor-pointer text-sm font-bold">Edit theme</summary>
                <form action={saveThemeAction} encType="multipart/form-data" className="mt-3 grid gap-3">
                  <input type="hidden" name="id" value={theme.id} />
                  <label className="field">Name<input className="input" name="name" defaultValue={theme.name} required /></label>
                  <label className="field">Background<input className="input h-10" name="background" defaultValue={settings.background} /></label>
                  <div className="field">
                    Background image
                    <input className="input" name="backgroundImage" defaultValue={settings.backgroundImage || ""} placeholder="https://example.com/background.jpg or /uploads/..." />
                    <input className="input" name="backgroundImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                    {settings.backgroundImage ? <span className="text-xs text-black/55">Current: {settings.backgroundImage}</span> : null}
                  </div>
                  <label className="field">Text<input className="input" name="foreground" type="color" defaultValue={settings.foreground} /></label>
                  <label className="field">Muted<input className="input" name="muted" type="color" defaultValue={settings.muted} /></label>
                  <label className="field">Button background<input className="input h-10" name="buttonBackground" defaultValue={settings.buttonBackground} /></label>
                  <label className="field">Button text<input className="input" name="buttonForeground" type="color" defaultValue={settings.buttonForeground} /></label>
                  <label className="field">Button border<input className="input" name="buttonBorder" type="color" defaultValue={settings.buttonBorder} /></label>
                  <label className="field">Border width<input className="input" name="buttonBorderWidth" type="number" min="0" max="8" defaultValue={settings.buttonBorderWidth} /></label>
                  <label className="field">Accent<input className="input" name="accent" type="color" defaultValue={settings.accent} /></label>
                  <label className="field">Font<input className="input" name="fontFamily" defaultValue={settings.fontFamily} /></label>
                  <label className="field">Radius<input className="input" name="radius" type="number" defaultValue={settings.radius} /></label>
                  <label className="field">Shadow<input className="input" name="shadow" defaultValue={settings.shadow} /></label>
                  <label className="field">Layout<select className="input" name="layout" defaultValue={settings.layout}><option>stack</option><option>compact</option><option>spotlight</option></select></label>
                  <SubmitButton>Save theme</SubmitButton>
                </form>
              </details>
            </div>
          );
        })}
      </div>
      <form action={saveThemeAction} encType="multipart/form-data" className="panel grid gap-4 md:grid-cols-3">
        <h2 className="text-xl font-black md:col-span-3">Create theme</h2>
        <label className="field">Name<input className="input" name="name" required /></label>
        <label className="field">Background<input className="input h-10" name="background" defaultValue="#fbfaf7" /></label>
        <div className="field">
          Background image
          <input className="input" name="backgroundImage" placeholder="https://example.com/background.jpg or /uploads/..." />
          <input className="input" name="backgroundImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        </div>
        <label className="field">Text<input className="input" name="foreground" type="color" defaultValue="#151515" /></label>
        <label className="field">Muted<input className="input" name="muted" type="color" defaultValue="#66615b" /></label>
        <label className="field">Button<input className="input h-10" name="buttonBackground" defaultValue="#151515" /></label>
        <label className="field">Button text<input className="input" name="buttonForeground" type="color" defaultValue="#ffffff" /></label>
        <label className="field">Button border<input className="input" name="buttonBorder" type="color" defaultValue="#151515" /></label>
        <label className="field">Border width<input className="input" name="buttonBorderWidth" type="number" min="0" max="8" defaultValue="1" /></label>
        <label className="field">Accent<input className="input" name="accent" type="color" defaultValue="#2f8f9d" /></label>
        <label className="field">Font<input className="input" name="fontFamily" defaultValue="Inter, ui-sans-serif, system-ui" /></label>
        <label className="field">Radius<input className="input" name="radius" type="number" defaultValue="8" /></label>
        <label className="field">Shadow<input className="input" name="shadow" defaultValue="0 12px 28px rgba(21,21,21,.12)" /></label>
        <label className="field">Layout<select className="input" name="layout"><option>stack</option><option>compact</option><option>spotlight</option></select></label>
        <div className="md:col-span-3"><SubmitButton>Create theme</SubmitButton></div>
      </form>
    </div>
  );
}
