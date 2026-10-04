"use client";

import { ArrowLeft, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBlock, type BlockInput } from "@/app/editor-actions";
import { uploadMedia } from "@/components/editor/upload";
import { Dialog } from "@/components/ui/overlay";
import { type CatalogItem, catalog, catalogGroups, normalizeContactUrl, normalizeWebUrl } from "@/lib/content-catalog";
import type { EditorBlock } from "@/lib/editor-types";

export function AddContentDialog({
  open,
  onClose,
  onCreated,
  onOpenSocials,
  onOpenShare,
  initialItem
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (block: EditorBlock) => void;
  onOpenSocials: () => void;
  onOpenShare: () => void;
  initialItem?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [item, setItem] = useState<CatalogItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setItem(initialItem ? catalog.find((entry) => entry.id === initialItem) || null : null);
  }, [open, initialItem]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? catalog.filter((entry) => `${entry.label} ${entry.description} ${entry.keywords || ""}`.toLowerCase().includes(q)) : catalog;
  }, [query]);

  function choose(entry: CatalogItem) {
    if (entry.type === "socials") {
      onClose();
      onOpenSocials();
      return;
    }
    if (entry.type === "qr") {
      onClose();
      onOpenShare();
      return;
    }
    setItem(entry);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={
        item ? (
          <span className="flex items-center gap-2">
            <button className="icon-btn -ml-2" onClick={() => setItem(null)} aria-label="Back to all content">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            Add {item.label.toLowerCase()}
          </span>
        ) : (
          "Add to your page"
        )
      }
    >
      {item ? (
        <QuickForm key={item.id} item={item} onCreated={onCreated} />
      ) : (
        <div className="grid gap-5">
          <label className="relative block">
            <span className="sr-only">Search content types</span>
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className="input w-full rounded-full !pl-10" placeholder="Search: YouTube, email, shop…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
          </label>
          {catalogGroups.map((group) => {
            const items = results.filter((entry) => entry.group === group);
            if (!items.length) return null;
            return (
              <section key={group} aria-label={group}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{group}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <button key={entry.id} type="button" onClick={() => choose(entry)} className="flex items-center gap-3 rounded-2xl border border-[var(--ui-border)] p-3 text-left transition hover:border-[var(--ui-accent)] hover:bg-[var(--ui-accent-soft)]">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f1ee] text-[var(--ui-ink)]">
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{entry.label}</span>
                          <span className="block truncate text-xs text-muted">{entry.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!results.length ? <p className="py-6 text-center text-sm text-muted">Nothing matches “{query}”. Try “link” or “video”.</p> : null}
        </div>
      )}
    </Dialog>
  );
}

function QuickForm({ item, onCreated }: { item: CatalogItem; onCreated: (block: EditorBlock) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [titleSuggestion, setTitleSuggestion] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const hasUrl = Boolean(item.urlPlaceholder);

  function cleanUrl(value: string) {
    return item.type === "CONTACT" ? normalizeContactUrl(value) : normalizeWebUrl(value);
  }

  async function suggestTitle() {
    const target = cleanUrl(url);
    if (title || !/^https?:\/\//.test(target)) return;
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(target)}`);
      const data = await response.json();
      if (response.ok && data.title) setTitleSuggestion(String(data.title).slice(0, 120));
    } catch {
      // Suggestions are optional.
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const result = await uploadMedia(file, "blocks");
    setBusy(false);
    if (result.ok) setImageUrl(result.data);
    else setError(result.error);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input: BlockInput = {
      type: item.type as BlockInput["type"],
      // Links fall back to the page's own title (or its domain); other types use the example title.
      title: title || titleSuggestion || (item.type === "LINK" && item.id === "link" ? "" : item.titlePlaceholder || ""),
      url: hasUrl && url ? cleanUrl(url) : null,
      description: item.bodyField ? body : null,
      imageUrl: imageUrl || null,
      metadata: item.metadata
    };
    const result = await createBlock(input);
    setBusy(false);
    if (result.ok) onCreated(result.data);
    else setError(result.error);
  }

  if (item.type === "SEPARATOR") {
    return (
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-sm text-muted">A thin line that separates sections of your page. You can drag it anywhere after adding it.</p>
        {error ? <p role="alert" className="text-sm font-semibold text-[var(--ui-danger)]">{error}</p> : null}
        <button className="btn-accent justify-self-end" disabled={busy}>{busy ? "Adding…" : "Add divider"}</button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {item.upload ? (
        <div className="grid gap-2">
          <span className="text-sm font-bold">Image</span>
          <button type="button" onClick={() => fileInput.current?.click()} className="grid min-h-40 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-[var(--ui-border-strong)] bg-[#fafaf8] text-sm font-semibold text-muted hover:border-[var(--ui-accent)]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="max-h-60 w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2">
                <Upload size={22} aria-hidden="true" /> {busy ? "Uploading…" : "Choose an image (JPG, PNG, WebP, GIF)"}
              </span>
            )}
          </button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload image" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
        </div>
      ) : null}
      {hasUrl ? (
        <label className="field">
          {item.urlLabel || "URL"}
          <input
            className="input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={suggestTitle}
            placeholder={item.urlPlaceholder}
            inputMode={item.type === "CONTACT" ? "email" : "url"}
            autoFocus={!item.upload}
            required={item.requiresUrl}
          />
        </label>
      ) : null}
      <div className="field">
        <label htmlFor="quick-title">{item.type === "HEADER" ? "Heading" : item.type === "IMAGE" ? "Caption" : "Title"}</label>
        <input
          id="quick-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={titleSuggestion || item.titlePlaceholder}
          maxLength={120}
          autoFocus={!hasUrl && !item.upload}
          required={item.type === "HEADER" || item.type === "TEXT"}
          aria-describedby={item.id === "link" && !title ? "quick-title-hint" : undefined}
        />
        {item.id === "link" && !title ? (
          <span id="quick-title-hint" className="field-hint">
            Optional. Leave empty to use the page’s own title.
          </span>
        ) : null}
      </div>
      {item.bodyField ? (
        <label className="field">
          {item.type === "TEXT" ? "Text" : "Description (optional)"}
          <textarea className="input" rows={3} value={body} onChange={(event) => setBody(event.target.value)} maxLength={400} required={item.type === "TEXT"} placeholder={item.type === "TEXT" ? "Tell visitors something…" : "What will people get by subscribing?"} />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-[#fff1f1] p-3 text-sm font-semibold text-[var(--ui-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button className="btn-accent" disabled={busy || (item.upload && !imageUrl)}>
          {busy ? "Adding…" : `Add ${item.label.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
