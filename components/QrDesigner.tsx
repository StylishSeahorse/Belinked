"use client";

import { useState } from "react";

/** Preview + download for the profile QR code. Colours are kept high-contrast by default. */
export function QrDesigner({ target }: { target: string }) {
  const [dark, setDark] = useState("#151515");
  const [light, setLight] = useState("#ffffff");
  const [size, setSize] = useState("1024");
  const query = (extra: Record<string, string>) => new URLSearchParams({ dark, light, size, ...extra }).toString();

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/qr?${query({ format: "svg" })}`} alt={`QR code linking to ${target}`} className="aspect-square w-44 rounded-md bg-white p-1" />
      <div className="grid content-start gap-3">
        <p className="text-sm text-black/60">
          Points to <strong>{target}</strong>. Keep strong contrast between the colours so phones can scan it.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <label className="field">
            Foreground
            <input className="input h-10" type="color" value={dark} onChange={(event) => setDark(event.target.value)} />
          </label>
          <label className="field">
            Background
            <input className="input h-10" type="color" value={light} onChange={(event) => setLight(event.target.value)} />
          </label>
          <label className="field">
            PNG size
            <select className="input" value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="512">512px</option>
              <option value="1024">1024px</option>
              <option value="2048">2048px</option>
              <option value="4096">4096px (print)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/api/qr?${query({ format: "png", download: "1" })}`}>Download PNG</a>
          <a className="btn-secondary" href={`/api/qr?${query({ format: "svg", download: "1" })}`}>Download SVG</a>
        </div>
      </div>
    </div>
  );
}
