"use client";

import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/overlay";

/** Everything needed to share the page: link, open, native share and QR code. */
export function ShareDialog({ open, onClose, url, isPublished }: { open: boolean; onClose: () => void; url: string; isPublished: boolean }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [dark, setDark] = useState("#16161d");
  const [light, setLight] = useState("#ffffff");

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.getElementById("share-url") as HTMLInputElement | null;
      input?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const qs = (extra: Record<string, string>) => new URLSearchParams({ dark, light, ...extra }).toString();

  return (
    <Dialog open={open} onClose={onClose} title="Share your page" description={isPublished ? "Your page is live. Anyone with the link can see it." : "Your page is unpublished. Publish it so visitors can see it."}>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <label htmlFor="share-url" className="text-sm font-bold">
            Your link
          </label>
          <div className="flex items-center gap-2 rounded-full border border-[var(--ui-border-strong)] bg-[#f7f7f5] p-1.5 pl-4">
            <input id="share-url" readOnly value={url} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onFocus={(event) => event.currentTarget.select()} />
            <button className="btn btn-sm" onClick={copy}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary btn-sm" href={url} target="_blank" rel="noopener">
              <ExternalLink size={14} aria-hidden="true" /> Open page
            </a>
            {canShare ? (
              <button className="btn-secondary btn-sm" onClick={() => navigator.share({ url, title: "My links" }).catch(() => undefined)}>
                <Share2 size={14} aria-hidden="true" /> Share…
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand */}
          <img src={`/api/qr?${qs({ format: "svg" })}`} alt={`QR code for ${url}`} className="aspect-square w-40 rounded-2xl border border-[var(--ui-border)] bg-white p-2" />
          <div className="grid gap-3">
            <p className="text-sm font-bold">QR code</p>
            <p className="text-sm text-muted">For posters, merch and business cards. Keep strong contrast so phones can scan it.</p>
            <div className="flex gap-3">
              <label className="field text-xs">
                Colour
                <input className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--ui-border-strong)]" type="color" value={dark} onChange={(event) => setDark(event.target.value)} />
              </label>
              <label className="field text-xs">
                Background
                <input className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--ui-border-strong)]" type="color" value={light} onChange={(event) => setLight(event.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary btn-sm" href={`/api/qr?${qs({ format: "png", size: "2048", download: "1" })}`}>
                <Download size={14} aria-hidden="true" /> PNG
              </a>
              <a className="btn-secondary btn-sm" href={`/api/qr?${qs({ format: "svg", download: "1" })}`}>
                <Download size={14} aria-hidden="true" /> SVG
              </a>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
