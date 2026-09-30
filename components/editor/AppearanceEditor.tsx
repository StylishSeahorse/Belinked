"use client";

import { Check, ImageIcon, Palette, Upload, Video } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { saveCustomTheme, selectTheme, uploadFile } from "@/app/editor-actions";
import { LivePreview, type PreviewData } from "@/components/editor/LivePreview";
import { useAutosave } from "@/components/editor/useAutosave";
import { useFeedback } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/overlay";
import { CUSTOM_THEME_NAME } from "@/lib/editor-types";
import { fontPresets, normalizeTheme, type ThemeSettings } from "@/lib/themes";

type ThemeOption = { id: string; name: string; settings: ThemeSettings };
type Tab = "theme" | "background" | "buttons" | "fonts" | "layout";

const TABS: Array<[Tab, string]> = [
  ["theme", "Theme"],
  ["background", "Background"],
  ["buttons", "Buttons"],
  ["fonts", "Fonts"],
  ["layout", "Layout"]
];

const SHADOWS: Array<[string, string]> = [
  ["none", "None"],
  ["0 8px 22px rgba(0,0,0,.12)", "Soft"],
  ["0 2px 0 rgba(0,0,0,.12)", "Subtle"],
  ["4px 4px 0 rgba(0,0,0,.9)", "Hard"]
];

function hex(value: string, fallback = "#000000") {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function detectBackground(settings: ThemeSettings): "solid" | "gradient" | "image" | "video" {
  if (settings.backgroundVideo) return "video";
  if (settings.backgroundImage) return "image";
  if (/gradient/.test(settings.background)) return "gradient";
  return "solid";
}

function gradientParts(background: string) {
  const match = background.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-f]{6})(?:\s+\d+%)?,\s*(?:#[0-9a-f]{6}\s+\d+%,\s*)?(#[0-9a-f]{6})/i);
  return match ? { angle: Number(match[1]), from: match[2], to: match[3] } : { angle: 160, from: "#e4fbff", to: "#fdf7e7" };
}

/** A miniature rendering of a theme, so choices are visual rather than names. */
function ThemeSwatch({ settings }: { settings: ThemeSettings }) {
  const outline = settings.buttonFill === "outline";
  return (
    <div className="grid h-full content-center justify-items-center gap-1.5 bg-cover bg-center p-3" style={{ background: settings.background, backgroundImage: settings.backgroundImage ? `url("${settings.backgroundImage}")` : undefined, color: settings.foreground, fontFamily: settings.fontFamily }}>
      <span className="mb-1 h-6 w-6 rounded-full" style={{ background: settings.accent }} />
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="block h-3.5 w-full"
          style={{
            background: outline ? "transparent" : settings.buttonBackground,
            border: `${Math.max(1, settings.buttonBorderWidth)}px solid ${settings.buttonBorder}`,
            borderRadius: Math.min(settings.radius, 10)
          }}
        />
      ))}
    </div>
  );
}

function ChoiceCard({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="group grid gap-1.5 text-left">
      <span className={`relative block overflow-hidden rounded-2xl border-2 transition ${selected ? "border-[var(--ui-accent)] shadow-[0_0_0_4px_var(--ui-accent-soft)]" : "border-[var(--ui-border)] group-hover:border-[var(--ui-border-strong)]"}`}>
        {children}
        {selected ? (
          <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--ui-accent)] text-white" aria-hidden="true">
            <Check size={12} />
          </span>
        ) : null}
      </span>
      <span className="truncate px-0.5 text-xs font-bold">{label}</span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      {label}
      <span className="flex items-center gap-2 rounded-xl border border-[var(--ui-border-strong)] bg-white p-1.5 focus-within:border-[var(--ui-accent)]">
        <input type="color" value={hex(value)} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={`${label} colour picker`} />
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs font-normal uppercase outline-none" maxLength={60} aria-label={`${label} colour value`} />
      </span>
    </label>
  );
}

function Slider({ label, value, min, max, unit = "", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span className="flex justify-between">
        {label} <span className="text-muted">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--ui-accent)]" />
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-black">{title}</h3>
      {children}
    </section>
  );
}

export function AppearanceEditor({ themes: initialThemes, activeId, preview }: { themes: ThemeOption[]; activeId: string | null; preview: Omit<PreviewData, "settings"> }) {
  const { toast, track } = useFeedback();
  const { schedule } = useAutosave(500);
  const [themes, setThemes] = useState(initialThemes);
  const [selectedId, setSelectedId] = useState(activeId);
  const [settings, setSettings] = useState<ThemeSettings>(() => themes.find((theme) => theme.id === activeId)?.settings || normalizeTheme({}));
  const [tab, setTab] = useState<Tab>("theme");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [bgMode, setBgMode] = useState(() => detectBackground(settings));
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const latest = useRef(settings);

  const update = useCallback(
    (patch: Partial<ThemeSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        latest.current = next;
        return next;
      });
      schedule("theme", async () => {
        const result = await saveCustomTheme(latest.current);
        if (!result.ok) {
          toast(result.error, { tone: "error" });
          return result;
        }
        setSelectedId(result.data.id);
        setThemes((current) =>
          current.some((theme) => theme.id === result.data.id)
            ? current.map((theme) => (theme.id === result.data.id ? { ...theme, settings: latest.current } : theme))
            : [{ id: result.data.id, name: CUSTOM_THEME_NAME, settings: latest.current }, ...current]
        );
        return result;
      });
    },
    [schedule, toast]
  );

  async function choose(theme: ThemeOption) {
    setSelectedId(theme.id);
    setSettings(theme.settings);
    latest.current = theme.settings;
    setBgMode(detectBackground(theme.settings));
    const result = await track(selectTheme(theme.id));
    if (!result.ok) toast(result.error, { tone: "error" });
  }

  async function upload(file: File, kind: "image" | "video") {
    setUploading(kind);
    const form = new FormData();
    form.set("file", file);
    form.set("folder", "themes");
    if (kind === "video") form.set("kind", "media");
    const result = await track(uploadFile(form));
    setUploading(null);
    if (!result.ok) return toast(result.error, { tone: "error" });
    update(kind === "image" ? { backgroundImage: result.data, backgroundVideo: undefined } : { backgroundVideo: result.data });
  }

  const gradient = gradientParts(settings.background);
  const setGradient = (patch: Partial<typeof gradient>) => {
    const next = { ...gradient, ...patch };
    update({ background: `linear-gradient(${next.angle}deg, ${next.from} 0%, ${next.to} 100%)` });
  };

  const previewData = useMemo(() => ({ ...preview, settings: normalizeTheme(settings as unknown as Record<string, unknown>) }), [preview, settings]);
  const presets = themes.filter((theme) => theme.name !== CUSTOM_THEME_NAME);
  const custom = themes.find((theme) => theme.name === CUSTOM_THEME_NAME);

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:py-8 xl:pb-8">
        <div className="mx-auto grid max-w-[720px] grid-cols-[minmax(0,1fr)] gap-6">
          <div>
            <h1 className="text-2xl font-black">Appearance</h1>
            <p className="text-sm text-muted">Pick a theme, then make it yours. Everything saves automatically.</p>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="segmented" role="tablist" aria-label="Appearance sections">
              {TABS.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="whitespace-nowrap">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel grid gap-7" role="tabpanel" aria-label={TABS.find(([id]) => id === tab)?.[1]}>
            {tab === "theme" ? (
              <>
                {custom ? (
                  <Group title="Your theme">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      <ChoiceCard selected={selectedId === custom.id} onClick={() => choose(custom)} label="Custom">
                        <div className="aspect-[3/4]">
                          <ThemeSwatch settings={custom.id === selectedId ? settings : custom.settings} />
                        </div>
                      </ChoiceCard>
                    </div>
                  </Group>
                ) : null}
                <Group title="Themes">
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {presets.map((theme) => (
                      <ChoiceCard key={theme.id} selected={selectedId === theme.id} onClick={() => choose(theme)} label={theme.name}>
                        <div className="aspect-[3/4]">
                          <ThemeSwatch settings={theme.settings} />
                        </div>
                      </ChoiceCard>
                    ))}
                  </div>
                  <p className="text-xs text-muted">Tip: after choosing a theme, fine-tune it in the other tabs. Your changes are saved as “Custom”, so the original themes stay intact.</p>
                </Group>
              </>
            ) : null}

            {tab === "background" ? (
              <>
                <Group title="Background type">
                  <div className="grid grid-cols-4 gap-3">
                    {(
                      [
                        ["solid", "Solid", <span key="s" className="block h-full w-full" style={{ background: hex(settings.background, "#f4f4f2") }} />],
                        ["gradient", "Gradient", <span key="g" className="block h-full w-full" style={{ background: `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})` }} />],
                        ["image", "Image", <span key="i" className="grid h-full w-full place-items-center bg-[#eeeeea] text-muted"><ImageIcon size={20} /></span>],
                        ["video", "Video", <span key="v" className="grid h-full w-full place-items-center bg-[#eeeeea] text-muted"><Video size={20} /></span>]
                      ] as const
                    ).map(([mode, label, swatch]) => (
                      <ChoiceCard
                        key={mode}
                        selected={bgMode === mode}
                        label={label}
                        onClick={() => {
                          setBgMode(mode);
                          if (mode === "solid") update({ background: hex(settings.background, "#f4f4f2"), backgroundImage: undefined, backgroundVideo: undefined });
                          if (mode === "gradient") update({ background: `linear-gradient(${gradient.angle}deg, ${gradient.from} 0%, ${gradient.to} 100%)`, backgroundImage: undefined, backgroundVideo: undefined });
                          if (mode === "image" && !settings.backgroundImage) imageInput.current?.click();
                          if (mode === "video" && !settings.backgroundVideo) videoInput.current?.click();
                        }}
                      >
                        <span className="block aspect-square">{swatch}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                  <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload background image" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "image")} />
                  <input ref={videoInput} type="file" accept="video/mp4,video/webm" className="sr-only" aria-label="Upload background video" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "video")} />
                </Group>

                {bgMode === "solid" ? <ColorField label="Colour" value={settings.background} onChange={(background) => update({ background })} /> : null}
                {bgMode === "gradient" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField label="From" value={gradient.from} onChange={(from) => setGradient({ from })} />
                    <ColorField label="To" value={gradient.to} onChange={(to) => setGradient({ to })} />
                    <div className="sm:col-span-2">
                      <Slider label="Angle" value={gradient.angle} min={0} max={360} unit="°" onChange={(angle) => setGradient({ angle })} />
                    </div>
                  </div>
                ) : null}
                {bgMode === "image" || bgMode === "video" ? (
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-secondary btn-sm" disabled={Boolean(uploading)} onClick={() => (bgMode === "image" ? imageInput : videoInput).current?.click()}>
                        <Upload size={14} aria-hidden="true" /> {uploading ? "Uploading…" : `Upload ${bgMode}`}
                      </button>
                      {(bgMode === "image" ? settings.backgroundImage : settings.backgroundVideo) ? (
                        <button className="btn-ghost btn-sm" onClick={() => (setBgMode("solid"), update(bgMode === "image" ? { backgroundImage: undefined } : { backgroundVideo: undefined }))}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {bgMode === "video" ? <p className="text-xs text-muted">Videos play muted on loop, and are hidden for visitors who prefer reduced motion. Keep them short and small (under 10MB).</p> : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Slider label="Darken" value={settings.backgroundOverlay || 0} min={0} max={90} unit="%" onChange={(backgroundOverlay) => update({ backgroundOverlay })} />
                      <Slider label="Blur" value={settings.backgroundBlur || 0} min={0} max={20} unit="px" onChange={(backgroundBlur) => update({ backgroundBlur })} />
                    </div>
                    <ColorField label="Fallback colour" value={hex(settings.background, "#16161d")} onChange={(background) => update({ background })} />
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "buttons" ? (
              <>
                <Group title="Style">
                  <div className="grid grid-cols-3 gap-3">
                    {(["solid", "outline", "soft"] as const).map((fill) => (
                      <ChoiceCard key={fill} selected={(settings.buttonFill || "solid") === fill} onClick={() => update({ buttonFill: fill })} label={{ solid: "Fill", outline: "Outline", soft: "Glass" }[fill]}>
                        <span className="grid h-16 place-items-center bg-[#f6f6f3] px-4">
                          <span
                            className="block h-6 w-full"
                            style={{
                              background: fill === "outline" ? "transparent" : fill === "soft" ? "rgba(22,22,29,.12)" : "#16161d",
                              border: "2px solid #16161d",
                              borderRadius: Math.min(settings.radius, 14)
                            }}
                          />
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                </Group>
                <Group title="Shape">
                  <div className="grid grid-cols-4 gap-3">
                    {([["Square", 0], ["Rounded", 10], ["Round", 18], ["Pill", 40]] as const).map(([label, radius]) => (
                      <ChoiceCard key={label} selected={settings.radius === radius} onClick={() => update({ radius })} label={label}>
                        <span className="grid h-14 place-items-center bg-[#f6f6f3] px-3">
                          <span className="block h-6 w-full bg-[#16161d]" style={{ borderRadius: radius }} />
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                </Group>
                <div className="grid gap-4 sm:grid-cols-3">
                  <ColorField label="Button colour" value={settings.buttonBackground} onChange={(buttonBackground) => update({ buttonBackground })} />
                  <ColorField label="Button text" value={settings.buttonForeground} onChange={(buttonForeground) => update({ buttonForeground })} />
                  <ColorField label="Border" value={settings.buttonBorder} onChange={(buttonBorder) => update({ buttonBorder })} />
                </div>
                <Slider label="Border width" value={settings.buttonBorderWidth} min={0} max={8} unit="px" onChange={(buttonBorderWidth) => update({ buttonBorderWidth })} />
                <Group title="Shadow">
                  <div className="segmented flex-wrap" role="group" aria-label="Button shadow">
                    {SHADOWS.map(([value, label]) => (
                      <button key={label} aria-pressed={settings.shadow === value} onClick={() => update({ shadow: value })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Group>
                <Group title="Hover effect">
                  <div className="segmented flex-wrap" role="group" aria-label="Hover effect">
                    {(["lift", "grow", "glow", "none"] as const).map((effect) => (
                      <button key={effect} aria-pressed={(settings.hoverEffect || "lift") === effect} onClick={() => update({ hoverEffect: effect })} className="capitalize">
                        {effect}
                      </button>
                    ))}
                  </div>
                </Group>
              </>
            ) : null}

            {tab === "fonts" ? (
              <>
                <Group title="Font">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {fontPresets.map(([family, label]) => (
                      <ChoiceCard key={family} selected={settings.fontFamily === family} onClick={() => update({ fontFamily: family })} label={label}>
                        <span className="grid h-16 place-items-center bg-[#f6f6f3] text-2xl font-bold" style={{ fontFamily: family }}>
                          Aa
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                  <p className="text-xs text-muted">System font stacks: fast to load and no requests to third-party font services.</p>
                </Group>
                <Group title="Size">
                  <div className="segmented" role="group" aria-label="Text size">
                    {(["small", "normal", "large"] as const).map((size) => (
                      <button key={size} aria-pressed={(settings.fontSize || "normal") === size} onClick={() => update({ fontSize: size })} className="capitalize">
                        {size}
                      </button>
                    ))}
                  </div>
                </Group>
                <div className="grid gap-4 sm:grid-cols-3">
                  <ColorField label="Text" value={settings.foreground} onChange={(foreground) => update({ foreground })} />
                  <ColorField label="Secondary text" value={settings.muted} onChange={(muted) => update({ muted })} />
                  <ColorField label="Accent" value={settings.accent} onChange={(accent) => update({ accent })} />
                </div>
              </>
            ) : null}

            {tab === "layout" ? (
              <>
                <Group title="Profile header">
                  <div className="grid grid-cols-3 gap-3">
                    {([["compact", "Compact", 8], ["stack", "Classic", 12], ["spotlight", "Spotlight", 18]] as const).map(([layout, label, size]) => (
                      <ChoiceCard key={layout} selected={settings.layout === layout} onClick={() => update({ layout })} label={label}>
                        <span className="grid h-20 content-center justify-items-center gap-1 bg-[#f6f6f3]">
                          <span className="rounded-full bg-[#16161d]" style={{ width: size * 2, height: size * 2 }} />
                          <span className="h-1.5 w-12 rounded-full bg-[#c9c9c2]" />
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                </Group>
                <Group title="Picture shape">
                  <div className="segmented" role="group" aria-label="Picture shape">
                    {(["circle", "rounded", "square"] as const).map((shape) => (
                      <button key={shape} aria-pressed={(settings.avatarShape || "circle") === shape} onClick={() => update({ avatarShape: shape })} className="capitalize">
                        {shape}
                      </button>
                    ))}
                  </div>
                </Group>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Group title="Page width">
                    <div className="segmented" role="group" aria-label="Page width">
                      {(["narrow", "normal", "wide"] as const).map((width) => (
                        <button key={width} aria-pressed={(settings.maxWidth || "normal") === width} onClick={() => update({ maxWidth: width })} className="capitalize">
                          {width}
                        </button>
                      ))}
                    </div>
                  </Group>
                  <Group title="Spacing">
                    <div className="segmented" role="group" aria-label="Spacing">
                      {(["tight", "normal", "relaxed"] as const).map((spacing) => (
                        <button key={spacing} aria-pressed={(settings.spacing || "normal") === spacing} onClick={() => update({ spacing })} className="capitalize">
                          {spacing}
                        </button>
                      ))}
                    </div>
                  </Group>
                </div>
                <Group title="Entrance animation">
                  <div className="segmented" role="group" aria-label="Entrance animation">
                    {([["none", "None"], ["fade", "Fade in"], ["rise", "Rise in"]] as const).map(([entrance, label]) => (
                      <button key={entrance} aria-pressed={(settings.entrance || "none") === entrance} onClick={() => update({ entrance })}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted">Animations are skipped automatically for visitors who prefer reduced motion.</p>
                </Group>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <aside aria-label="Preview" className="sticky top-16 hidden h-[calc(100vh-4rem)] border-l border-[var(--ui-border)] bg-[#ebebe7] px-6 py-6 xl:block">
        <LivePreview data={previewData} />
      </aside>
      <button className="btn fixed bottom-20 right-4 z-20 shadow-xl md:bottom-6 xl:hidden" onClick={() => setPreviewOpen(true)}>
        <Palette size={16} aria-hidden="true" /> Preview
      </button>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" size="lg">
        <div className="h-[70vh]">
          <LivePreview data={previewData} />
        </div>
      </Dialog>
    </div>
  );
}
