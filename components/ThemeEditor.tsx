"use client";

import { useMemo, useState } from "react";
import { saveThemeAction } from "@/app/actions";
import type { PublicBlock, PublicProfileData, PublicSocial } from "@/lib/public-data";
import { fontPresets, normalizeTheme, themeOptions, type ThemeSettings } from "@/lib/themes";
import { PublicProfile } from "./PublicProfile";
import { SubmitButton } from "./SubmitButton";

type BackgroundMode = "solid" | "gradient" | "custom";

function detectMode(background: string): BackgroundMode {
  if (/^#[0-9a-f]{3,8}$/i.test(background)) return "solid";
  if (/^linear-gradient\(\d+deg,\s*#[0-9a-f]{6}(\s+0%)?,\s*#[0-9a-f]{6}(\s+100%)?\)$/i.test(background)) return "gradient";
  return "custom";
}

function gradientParts(background: string) {
  const match = background.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-f]{6})(?:\s+0%)?,\s*(#[0-9a-f]{6})/i);
  return match ? { angle: Number(match[1]), from: match[2], to: match[3] } : { angle: 160, from: "#e4fbff", to: "#fdf7e7" };
}

function colorValue(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

const labels: Record<string, string> = {
  stack: "Classic",
  compact: "Compact",
  spotlight: "Spotlight",
  circle: "Circle",
  rounded: "Rounded",
  square: "Square",
  lift: "Lift",
  grow: "Grow",
  glow: "Glow",
  none: "None",
  fade: "Fade in",
  rise: "Rise in",
  narrow: "Narrow",
  normal: "Normal",
  wide: "Wide",
  tight: "Tight",
  relaxed: "Relaxed",
  small: "Small",
  large: "Large",
  solid: "Solid",
  outline: "Outline",
  soft: "Soft / glass"
};

function Choice<K extends keyof ThemeSettings>({ label, name, options, settings, set }: { label: string; name: K; options: readonly string[]; settings: ThemeSettings; set: (key: K, value: ThemeSettings[K]) => void }) {
  return (
    <label className="field">
      {label}
      <select className="input" name={name} value={String(settings[name] ?? "")} onChange={(event) => set(name, event.target.value as ThemeSettings[K])}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      {label}
      <span className="flex gap-2">
        <input className="input h-10 w-14 shrink-0 p-1" type="color" value={colorValue(value, "#000000")} onChange={(event) => onChange(event.target.value)} aria-label={`${label} colour picker`} />
        <input className="input font-mono text-xs" name={name} value={value} onChange={(event) => onChange(event.target.value)} maxLength={60} />
      </span>
    </label>
  );
}

export function ThemeEditor({
  id,
  name,
  initial,
  preview
}: {
  id?: string;
  name?: string;
  initial: ThemeSettings;
  preview: { profile: PublicProfileData; blocks: PublicBlock[]; socials: PublicSocial[] };
}) {
  const [settings, setSettings] = useState<ThemeSettings>(initial);
  const [mode, setMode] = useState<BackgroundMode>(() => detectMode(initial.background));
  const [gradient, setGradient] = useState(() => gradientParts(initial.background));
  const set = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const background = mode === "gradient" ? `linear-gradient(${gradient.angle}deg, ${gradient.from} 0%, ${gradient.to} 100%)` : settings.background;
  // Preview uses the same normalization the server applies on save.
  const previewSettings = useMemo(() => normalizeTheme({ ...settings, background }), [settings, background]);

  return (
    <form action={saveThemeAction} encType="multipart/form-data" className="grid gap-6 xl:grid-cols-[1fr_380px]">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="background" value={background} />
      <div className="grid content-start gap-5">
        <label className="field max-w-sm">
          Theme name
          <input className="input" name="name" defaultValue={name} maxLength={60} required />
        </label>

        <fieldset className="panel grid gap-4 md:grid-cols-3">
          <legend className="px-1 text-lg font-black">Background</legend>
          <label className="field">
            Type
            <select className="input" value={mode} onChange={(event) => setMode(event.target.value as BackgroundMode)}>
              <option value="solid">Solid colour</option>
              <option value="gradient">Gradient</option>
              <option value="custom">Custom CSS value</option>
            </select>
          </label>
          {mode === "solid" ? <ColorField label="Colour" name="_bg" value={settings.background} onChange={(value) => set("background", value)} /> : null}
          {mode === "gradient" ? (
            <>
              <ColorField label="From" name="_from" value={gradient.from} onChange={(from) => setGradient((current) => ({ ...current, from }))} />
              <ColorField label="To" name="_to" value={gradient.to} onChange={(to) => setGradient((current) => ({ ...current, to }))} />
              <label className="field">
                Angle ({gradient.angle}°)
                <input type="range" min={0} max={360} value={gradient.angle} onChange={(event) => setGradient((current) => ({ ...current, angle: Number(event.target.value) }))} />
              </label>
            </>
          ) : null}
          {mode === "custom" ? (
            <label className="field md:col-span-2">
              CSS background
              <input className="input font-mono text-xs" value={settings.background} onChange={(event) => set("background", event.target.value)} maxLength={240} />
              <span className="text-xs text-black/55">Colours or gradients only; images use the fields below.</span>
            </label>
          ) : null}
          <div className="field md:col-span-3">
            Background image
            <input className="input" name="backgroundImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload background image" />
            <input className="input" name="backgroundImage" value={settings.backgroundImage || ""} onChange={(event) => set("backgroundImage", event.target.value)} placeholder="or https:// image URL" aria-label="Background image URL" />
            {settings.backgroundImage ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/55">
                <input className="w-auto" type="checkbox" name="removeBackgroundImage" /> Remove background image
              </span>
            ) : null}
          </div>
          <div className="field md:col-span-3">
            Background video (muted loop; hidden for visitors who prefer reduced motion)
            <input className="input" name="backgroundVideoFile" type="file" accept="video/mp4,video/webm" aria-label="Upload background video" />
            <input className="input" name="backgroundVideo" value={settings.backgroundVideo || ""} onChange={(event) => set("backgroundVideo", event.target.value)} placeholder="or https:// .mp4 URL" aria-label="Background video URL" />
            {settings.backgroundVideo ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/55">
                <input className="w-auto" type="checkbox" name="removeBackgroundVideo" /> Remove background video
              </span>
            ) : null}
          </div>
          <label className="field">
            Dark overlay ({settings.backgroundOverlay || 0}%)
            <input type="range" name="backgroundOverlay" min={0} max={90} value={settings.backgroundOverlay || 0} onChange={(event) => set("backgroundOverlay", Number(event.target.value))} />
          </label>
          <label className="field">
            Blur ({settings.backgroundBlur || 0}px)
            <input type="range" name="backgroundBlur" min={0} max={20} value={settings.backgroundBlur || 0} onChange={(event) => set("backgroundBlur", Number(event.target.value))} />
          </label>
        </fieldset>

        <fieldset className="panel grid gap-4 md:grid-cols-3">
          <legend className="px-1 text-lg font-black">Text</legend>
          <ColorField label="Text colour" name="foreground" value={settings.foreground} onChange={(value) => set("foreground", value)} />
          <ColorField label="Secondary text" name="muted" value={settings.muted} onChange={(value) => set("muted", value)} />
          <ColorField label="Accent" name="accent" value={settings.accent} onChange={(value) => set("accent", value)} />
          <label className="field md:col-span-2">
            Font
            <select className="input" name="fontFamily" value={settings.fontFamily} onChange={(event) => set("fontFamily", event.target.value)}>
              {fontPresets.some(([value]) => value === settings.fontFamily) ? null : <option value={settings.fontFamily}>Custom: {settings.fontFamily}</option>}
              {fontPresets.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs text-black/55">System font stacks: fast, private, no external font requests.</span>
          </label>
          <Choice label="Text size" name="fontSize" options={themeOptions.fontSizes} settings={settings} set={set} />
        </fieldset>

        <fieldset className="panel grid gap-4 md:grid-cols-3">
          <legend className="px-1 text-lg font-black">Buttons</legend>
          <Choice label="Style" name="buttonFill" options={themeOptions.buttonFills} settings={settings} set={set} />
          <ColorField label="Button colour" name="buttonBackground" value={settings.buttonBackground} onChange={(value) => set("buttonBackground", value)} />
          <ColorField label="Button text" name="buttonForeground" value={settings.buttonForeground} onChange={(value) => set("buttonForeground", value)} />
          <ColorField label="Border colour" name="buttonBorder" value={settings.buttonBorder} onChange={(value) => set("buttonBorder", value)} />
          <label className="field">
            Border width ({settings.buttonBorderWidth}px)
            <input type="range" name="buttonBorderWidth" min={0} max={8} value={settings.buttonBorderWidth} onChange={(event) => set("buttonBorderWidth", Number(event.target.value))} />
          </label>
          <label className="field">
            Corner radius ({settings.radius}px)
            <input type="range" name="radius" min={0} max={40} value={settings.radius} onChange={(event) => set("radius", Number(event.target.value))} />
          </label>
          <label className="field md:col-span-2">
            Shadow (CSS)
            <input className="input font-mono text-xs" name="shadow" value={settings.shadow} onChange={(event) => set("shadow", event.target.value)} maxLength={240} />
          </label>
          <Choice label="Hover effect" name="hoverEffect" options={themeOptions.hoverEffects} settings={settings} set={set} />
        </fieldset>

        <fieldset className="panel grid gap-4 md:grid-cols-3">
          <legend className="px-1 text-lg font-black">Layout &amp; motion</legend>
          <Choice label="Header style" name="layout" options={themeOptions.layouts} settings={settings} set={set} />
          <Choice label="Picture shape" name="avatarShape" options={themeOptions.avatarShapes} settings={settings} set={set} />
          <Choice label="Page width" name="maxWidth" options={themeOptions.widths} settings={settings} set={set} />
          <Choice label="Spacing" name="spacing" options={themeOptions.spacings} settings={settings} set={set} />
          <Choice label="Entrance animation" name="entrance" options={themeOptions.entrances} settings={settings} set={set} />
          <p className="text-xs text-black/55 md:col-span-3">Animations are automatically disabled for visitors who ask their device for reduced motion.</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          {!id ? (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input className="w-auto" type="checkbox" name="applyNow" defaultChecked /> Use this theme now
            </label>
          ) : null}
          <SubmitButton>{id ? "Save theme" : "Create theme"}</SubmitButton>
        </div>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-sm font-semibold text-black/60">Live preview</p>
        <div className="h-[640px] overflow-y-auto overflow-x-hidden rounded-[28px] border-8 border-black/60 shadow-2xl" style={{ transform: "translateZ(0)" }}>
          <div inert>
          <PublicProfile profile={preview.profile} blocks={preview.blocks} socials={preview.socials} socialPlacement="top" settings={previewSettings} track={false} />
          </div>
        </div>
      </div>
    </form>
  );
}
