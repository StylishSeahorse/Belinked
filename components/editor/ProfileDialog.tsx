"use client";

import { ArrowDown, ArrowUp, Camera, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Dialog, Switch } from "@/components/ui/overlay";
import type { EditorProfile, EditorSocial } from "@/lib/editor-types";
import { detectSocialPlatform, SocialGlyph, socialLabelForIcon, type SocialPlacement } from "@/lib/socials";

export type ProfileTab = "profile" | "socials";

export function ProfileDialog({
  open,
  onClose,
  tab,
  onTabChange,
  profile,
  onProfileChange,
  onAvatarUpload,
  socials,
  placement,
  onPlacementChange,
  onAddSocial,
  onUpdateSocial,
  onRemoveSocial,
  onMoveSocial
}: {
  open: boolean;
  onClose: () => void;
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  profile: EditorProfile;
  onProfileChange: (patch: Partial<EditorProfile>) => void;
  onAvatarUpload: (file: File) => Promise<void>;
  socials: EditorSocial[];
  placement: SocialPlacement;
  onPlacementChange: (placement: SocialPlacement) => void;
  onAddSocial: (url: string) => Promise<boolean>;
  onUpdateSocial: (id: string, patch: Partial<EditorSocial>) => void;
  onRemoveSocial: (id: string) => void;
  onMoveSocial: (id: string, direction: -1 | 1) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newSocial, setNewSocial] = useState("");
  const [adding, setAdding] = useState(false);
  const detected = newSocial ? detectSocialPlatform(newSocial) : undefined;

  return (
    <Dialog open={open} onClose={onClose} variant="drawer" title="Your profile" description="Changes save automatically and appear in the preview right away.">
      <div className="segmented mb-5 w-full" role="tablist" aria-label="Profile sections">
        <button role="tab" aria-selected={tab === "profile"} className="flex-1" onClick={() => onTabChange("profile")}>
          Profile
        </button>
        <button role="tab" aria-selected={tab === "socials"} className="flex-1" onClick={() => onTabChange("socials")}>
          Social icons {socials.length ? `(${socials.length})` : ""}
        </button>
      </div>

      {tab === "profile" ? (
        <div className="grid gap-5" role="tabpanel">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileInput.current?.click()} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#ececea]" aria-label="Change profile picture">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-3xl font-black text-muted">{profile.displayName.slice(0, 1).toUpperCase() || "?"}</span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera size={22} aria-hidden="true" />
              </span>
            </button>
            <div className="grid gap-2">
              <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : profile.avatarUrl ? "Change picture" : "Upload picture"}
              </button>
              {profile.avatarUrl ? (
                <button type="button" className="btn-ghost btn-sm text-muted" onClick={() => onProfileChange({ avatarUrl: null })}>
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              aria-label="Upload profile picture"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                await onAvatarUpload(file);
                setUploading(false);
                event.target.value = "";
              }}
            />
          </div>
          <label className="field">
            Display name
            <input className="input" value={profile.displayName} maxLength={80} onChange={(event) => onProfileChange({ displayName: event.target.value })} />
          </label>
          <div className="field">
            <label htmlFor="profile-bio">Bio</label>
            <textarea id="profile-bio" className="input" rows={3} maxLength={280} value={profile.bio} onChange={(event) => onProfileChange({ bio: event.target.value })} placeholder="Tell visitors who you are" aria-describedby="profile-bio-count" />
            <span id="profile-bio-count" className="field-hint text-right">{profile.bio.length}/280 characters</span>
          </div>
          <div className="field">
            <label htmlFor="profile-badge">Badge</label>
            <input id="profile-badge" className="input" value={profile.badge || ""} maxLength={60} onChange={(event) => onProfileChange({ badge: event.target.value })} aria-describedby="profile-badge-hint" />
            <span id="profile-badge-hint" className="field-hint">Optional, e.g. “New album out now”.</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-5" role="tabpanel">
          <form
            className="grid gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!newSocial.trim()) return;
              setAdding(true);
              if (await onAddSocial(newSocial.trim())) setNewSocial("");
              setAdding(false);
            }}
          >
            <label className="field">
              Add a social profile
              <span className="flex gap-2">
                <input className="input flex-1" value={newSocial} onChange={(event) => setNewSocial(event.target.value)} placeholder="Paste a profile link, email or phone" />
                <button className="btn" disabled={adding || !newSocial.trim()}>
                  <Plus size={16} aria-hidden="true" /> Add
                </button>
              </span>
              <span className="field-hint" aria-live="polite">
                {newSocial ? (detected ? `Detected: ${socialLabelForIcon(detected)}` : "Will be added as a website link") : "We detect Instagram, TikTok, YouTube, X, Bluesky, email and 20+ more."}
              </span>
            </label>
          </form>

          {socials.length ? (
            <ul className="grid gap-2">
              {socials.map((social, index) => (
                <li key={social.id} className={`flex items-center gap-2 rounded-2xl border border-[var(--ui-border)] p-2 pl-3 ${social.isVisible ? "" : "opacity-60"}`}>
                  <SocialGlyph social={social} className="h-5 w-5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{social.label}</span>
                    <span className="block truncate text-xs text-muted">{social.url.replace(/^(https?:\/\/(www\.)?|mailto:|tel:)/, "")}</span>
                  </span>
                  <button className="icon-btn h-8 w-8" onClick={() => onMoveSocial(social.id, -1)} disabled={index === 0} aria-label={`Move ${social.label} up`}>
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-btn h-8 w-8" onClick={() => onMoveSocial(social.id, 1)} disabled={index === socials.length - 1} aria-label={`Move ${social.label} down`}>
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <Switch checked={social.isVisible} onChange={(isVisible) => onUpdateSocial(social.id, { isVisible })} label={`Show ${social.label}`} />
                  <button className="icon-btn h-8 w-8 hover:text-[var(--ui-danger)]" onClick={() => onRemoveSocial(social.id)} aria-label={`Remove ${social.label}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-[#f6f6f3] p-4 text-center text-sm text-muted">No social icons yet. Paste a link above and it appears under your bio.</p>
          )}

          <div className="grid gap-2">
            <span className="text-sm font-bold">Position</span>
            <div className="segmented" role="group" aria-label="Social icon position">
              <button aria-pressed={placement === "top"} onClick={() => onPlacementChange("top")}>
                Under bio
              </button>
              <button aria-pressed={placement === "bottom"} onClick={() => onPlacementChange("bottom")}>
                Bottom of page
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
