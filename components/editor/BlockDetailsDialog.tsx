"use client";

import { Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import type { BlockPatch } from "@/app/editor-actions";
import { uploadMedia } from "@/components/editor/upload";
import { IconPicker } from "@/components/editor/IconPicker";
import { Dialog } from "@/components/ui/overlay";
import { isPackIcon, PackIconGlyph } from "@/lib/icon-pack";
import { useFeedback } from "@/components/ui/feedback";
import { blockTypeLabels } from "@/lib/block-types";
import type { EditorBlock } from "@/lib/editor-types";
import { groupSize } from "@/lib/editor-types";

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function meta(block: EditorBlock): Record<string, unknown> {
  try {
    return JSON.parse(block.metadata || "{}");
  } catch {
    return {};
  }
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="grid gap-3 border-t border-[var(--ui-border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-black">{title}</h3>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

const hasUrl = (type: string) => !["HEADER", "TEXT", "SEPARATOR", "SUBSCRIBER_FORM"].includes(type);
const hasDescription = (type: string) => !["HEADER", "SEPARATOR", "IMAGE"].includes(type);
const hasMedia = (type: string) => !["HEADER", "TEXT", "SEPARATOR", "SUBSCRIBER_FORM"].includes(type);
const hasButton = (type: string) => ["VIDEO", "MUSIC", "PODCAST", "PRODUCT", "NEWSLETTER", "CALENDAR", "CONTACT"].includes(type);
const isEmbed = (type: string) => ["VIDEO", "MUSIC", "PODCAST", "EMBED"].includes(type);

export function BlockDetailsDialog({
  block,
  onClose,
  onChange,
  clicks,
  onFetchThumbnail,
  fetchingThumbnail = false
}: {
  block: EditorBlock | null;
  onClose: () => void;
  onChange: (patch: BlockPatch) => void;
  clicks?: number;
  /** Present for web links: pulls the preview image from the linked page. */
  onFetchThumbnail?: () => Promise<boolean>;
  fetchingThumbnail?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const { toast } = useFeedback();
  if (!block) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const data = meta(block);
  const setMeta = (key: string, value: string | number | null) => onChange({ metadata: { [key]: value } });
  const layout = block.type === "LINK" ? (block.featured ? "featured" : groupSize(block) > 1 ? `side-${groupSize(block)}` : "standard") : null;

  return (
    <Dialog open onClose={onClose} variant="drawer" title={`${blockTypeLabels[block.type]} settings`} description="Changes save automatically.">
      <div className="grid gap-6">
        <Section title="Content">
          <label className="field">
            {block.type === "HEADER" ? "Heading" : block.type === "IMAGE" ? "Caption" : "Title"}
            <input className="input" value={block.title} maxLength={120} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          {hasUrl(block.type) ? (
            <label className="field">
              {block.type === "IMAGE" ? "Link when tapped (optional)" : block.type === "CONTACT" ? "Email or phone link" : "URL"}
              <input className="input" value={block.url || ""} onChange={(event) => onChange({ url: event.target.value || null })} placeholder="https://" />
            </label>
          ) : null}
          {hasDescription(block.type) ? (
            <label className="field">
              {block.type === "TEXT" ? "Text" : "Description"} <span className="field-hint -mt-1">{block.type === "LINK" ? "Shown on featured links" : "Optional"}</span>
              <textarea className="input" rows={3} maxLength={400} value={block.description || ""} onChange={(event) => onChange({ description: event.target.value || null })} />
            </label>
          ) : null}
        </Section>

        {hasMedia(block.type) ? (
          <Section
            title={block.type === "IMAGE" ? "Image" : "Thumbnail"}
            hint={
              onFetchThumbnail
                ? data.autoThumbnail === true
                  ? "Picked automatically from the linked page. Upload your own to replace it."
                  : "Added automatically from the linked page when empty. Or upload your own, or pick an icon."
                : block.type === "LINK"
                  ? "Shown next to the title, or as a big banner on featured links."
                  : undefined
            }
          >
            <div className="flex items-center gap-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f1f1ee]">
                {block.imageUrl && !/\.(mp4|webm|ogv|mov)$/i.test(block.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : block.imageUrl ? (
                  <span className="text-xs font-bold text-muted">Video</span>
                ) : isPackIcon(block.icon) ? (
                  <PackIconGlyph id={block.icon} className="h-7 w-7" />
                ) : (
                  <Upload size={18} className="text-muted" aria-hidden="true" />
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? "Uploading…" : block.imageUrl ? "Replace" : "Upload"}
                </button>
                {block.type !== "IMAGE" ? (
                  <button type="button" className="btn-secondary btn-sm" aria-expanded={iconsOpen} onClick={() => setIconsOpen((open) => !open)}>
                    {iconsOpen ? "Hide icons" : "Choose icon"}
                  </button>
                ) : null}
                {onFetchThumbnail ? (
                  <button type="button" className="btn-secondary btn-sm" disabled={fetchingThumbnail} onClick={() => void onFetchThumbnail()}>
                    {fetchingThumbnail ? "Fetching…" : "Fetch from link"}
                  </button>
                ) : null}
                {(block.imageUrl || block.icon) && block.type !== "IMAGE" ? (
                  // Removing turns automatic thumbnails off for this link.
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({ imageUrl: null, icon: null, metadata: { autoThumbnail: "off" } })}>
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                aria-label="Upload thumbnail"
                accept={block.type === "LINK" || block.type === "VIDEO" ? "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/gif"}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const result = await uploadMedia(file, "blocks", "media");
                  setUploading(false);
                  event.target.value = "";
                  // An uploaded image is the owner's choice: never auto-replaced.
                  if (result.ok) onChange({ imageUrl: result.data, icon: null, metadata: { autoThumbnail: null } });
                  else toast(result.error, { tone: "error" });
                }}
              />
            </div>
            {iconsOpen && block.type !== "IMAGE" ? (
              <IconPicker
                value={block.icon}
                onSelect={(icon) => {
                  // A chosen icon replaces any image and stops automatic thumbnails.
                  onChange({ icon, imageUrl: null, metadata: { autoThumbnail: "off" } });
                  setIconsOpen(false);
                }}
              />
            ) : null}
          </Section>
        ) : null}

        {layout ? (
          <Section title="Layout">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Link layout">
              {[
                ["standard", "Classic", "Compact button"],
                ["featured", "Featured", "Large card with image"],
                ["side-2", "Side by side ×2", "Pairs with the next link"],
                ["side-3", "Side by side ×3", "Groups the next two links"]
              ].map(([value, label, hint]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={layout === value}
                  onClick={() => {
                    if (value === "featured") onChange({ featured: true, metadata: { inlineGroupSize: null } });
                    else onChange({ featured: false, metadata: { inlineGroupSize: value === "standard" ? null : Number(value.slice(-1)) } });
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${layout === value ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]" : "border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]"}`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
            <label className="field">
              Animation
              <select className="input" value={block.animation || ""} onChange={(event) => onChange({ animation: event.target.value || null })}>
                <option value="">None</option>
                <option value="pulse">Gentle pulse (draws attention)</option>
              </select>
            </label>
          </Section>
        ) : null}

        {hasButton(block.type) || isEmbed(block.type) || block.type === "SUBSCRIBER_FORM" ? (
          <Section title="Details">
            {hasButton(block.type) ? (
              <label className="field">
                Button label
                <input className="input" value={String(data.buttonLabel || "")} maxLength={40} onChange={(event) => setMeta("buttonLabel", event.target.value)} placeholder="e.g. Watch, Listen, Book now" />
              </label>
            ) : null}
            {block.type === "PRODUCT" ? (
              <label className="field">
                Price
                <input className="input" value={String(data.price || "")} maxLength={30} onChange={(event) => setMeta("price", event.target.value)} placeholder="$29" />
              </label>
            ) : null}
            {["NEWSLETTER", "CALENDAR", "CONTACT"].includes(block.type) ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  Second button
                  <input className="input" value={String(data.secondaryLabel || "")} maxLength={40} onChange={(event) => setMeta("secondaryLabel", event.target.value)} placeholder="Label" />
                </label>
                <label className="field">
                  Its link
                  <input className="input" value={String(data.secondaryUrl || "")} onChange={(event) => setMeta("secondaryUrl", event.target.value)} placeholder="https:// or tel:" />
                </label>
              </div>
            ) : null}
            {isEmbed(block.type) ? (
              <label className="field">
                Player link <span className="field-hint -mt-1">Only if the player should differ from the main URL</span>
                <input className="input" value={String(data.embedUrl || "")} onChange={(event) => setMeta("embedUrl", event.target.value)} placeholder="https://open.spotify.com/…" />
              </label>
            ) : null}
            {block.type === "SUBSCRIBER_FORM" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  Placeholder
                  <input className="input" value={String(data.inputPlaceholder || "")} maxLength={60} onChange={(event) => setMeta("inputPlaceholder", event.target.value)} placeholder="Email address" />
                </label>
                <label className="field">
                  Button
                  <input className="input" value={String(data.submitLabel || "")} maxLength={40} onChange={(event) => setMeta("submitLabel", event.target.value)} placeholder="Subscribe" />
                </label>
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section title="Schedule" hint="Show this only during a time window. Times are in your timezone.">
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              Show from
              <input className="input" type="datetime-local" value={toLocalInput(block.startsAt)} onChange={(event) => onChange({ startsAt: fromLocalInput(event.target.value) })} />
            </label>
            <label className="field">
              Hide after
              <input className="input" type="datetime-local" value={toLocalInput(block.endsAt)} onChange={(event) => onChange({ endsAt: fromLocalInput(event.target.value) })} />
            </label>
          </div>
        </Section>

        {block.type === "LINK" ? (
          <Section title="Tracking" hint={`${clicks ?? 0} clicks in the last 30 days. UTM tags are added when visitors click.`}>
            <div className="grid grid-cols-3 gap-2">
              {(["utmSource", "utmMedium", "utmCampaign"] as const).map((key) => (
                <label key={key} className="field text-xs">
                  {key.replace("utm", "UTM ").toLowerCase()}
                  <input className="input" value={block[key] || ""} maxLength={80} onChange={(event) => onChange({ [key]: event.target.value || null })} />
                </label>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Private note" hint="Only you can see this.">
          <textarea className="input" rows={2} maxLength={400} value={block.internalNote || ""} onChange={(event) => onChange({ internalNote: event.target.value || null })} aria-label="Private note" />
        </Section>
      </div>
    </Dialog>
  );
}
