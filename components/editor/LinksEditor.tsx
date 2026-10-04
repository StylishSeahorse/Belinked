"use client";

import {
  BarChart3,
  Check,
  CircleAlert,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  ImageDown,
  Loader2,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkLinksAction, importLinksCsvAction, saveBlockLayoutAction } from "@/app/actions";
import {
  addSocial,
  autoThumbnail,
  type BlockPatch,
  deleteBlock,
  deleteSocial,
  dismissOnboarding,
  duplicateBlock,
  type ProfilePatch,
  reorderSocials,
  setSocialPlacement,
  updateBlock,
  updateProfile,
  updateSocial
} from "@/app/editor-actions";
import { uploadMedia } from "@/components/editor/upload";
import { usePageStatus } from "@/components/editor/AppShell";
import { AddContentDialog } from "@/components/editor/AddContentDialog";
import { BlockDetailsDialog } from "@/components/editor/BlockDetailsDialog";
import { LivePreview, type PreviewData } from "@/components/editor/LivePreview";
import { ProfileDialog, type ProfileTab } from "@/components/editor/ProfileDialog";
import { useAutosave } from "@/components/editor/useAutosave";
import { useFeedback } from "@/components/ui/feedback";
import { Dialog, Menu, MenuItem, Switch } from "@/components/ui/overlay";
import { blockTypeLabels } from "@/lib/block-types";
import { iconForBlock, normalizeContactUrl, normalizeWebUrl } from "@/lib/content-catalog";
import { isPackIcon, PackIconGlyph } from "@/lib/icon-pack";
import { type EditorBlock, type EditorProfile, type EditorSocial, groupSize, rowsFromOrder } from "@/lib/editor-types";
import { SocialGlyph, type SocialPlacement } from "@/lib/socials";
import type { ThemeSettings } from "@/lib/themes";

type Props = {
  initialBlocks: EditorBlock[];
  initialProfile: EditorProfile;
  initialSocials: EditorSocial[];
  initialPlacement: SocialPlacement;
  settings: ThemeSettings;
  footerText?: string;
  health: Record<string, { ok: boolean; message: string }>;
  clicks: Record<string, number>;
  onboarding: { dismissed: boolean; themeChosen: boolean };
};

function applyPatch(block: EditorBlock, patch: BlockPatch): EditorBlock {
  const { metadata, ...fields } = patch;
  const next = { ...block, ...fields } as EditorBlock;
  if (metadata) {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(block.metadata || "{}");
    } catch {
      current = {};
    }
    const merged = { ...current, ...metadata };
    for (const [key, value] of Object.entries(merged)) if (value === null || value === "") delete merged[key];
    next.metadata = JSON.stringify(merged);
  }
  return next;
}

function displayUrl(url?: string | null) {
  return (url || "").replace(/^(https?:\/\/(www\.)?|mailto:|tel:)/, "").replace(/\/$/, "");
}

/** Types whose thumbnail can be pulled from the linked page (matches the server). */
const THUMBNAIL_TYPES = new Set(["LINK", "PRODUCT", "NEWSLETTER", "CALENDAR"]);

const URL_TYPES = new Set(["LINK", "VIDEO", "MUSIC", "PODCAST", "EMBED", "NEWSLETTER", "CALENDAR", "CONTACT", "PRODUCT", "IMAGE"]);

export function LinksEditor(props: Props) {
  const { toast, track } = useFeedback();
  const { isPublished, setPublished, openShare } = usePageStatus();
  const { schedule, flush } = useAutosave();

  const [blocks, setBlocks] = useState(props.initialBlocks);
  const [profile, setProfile] = useState(props.initialProfile);
  const [socials, setSocials] = useState(props.initialSocials);
  const [placement, setPlacement] = useState(props.initialPlacement);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState<{ open: boolean; item?: string | null }>({ open: false });
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; tab: ProfileTab }>({ open: false, tab: "profile" });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(props.onboarding.dismissed);
  const [shared, setShared] = useState(false);
  const blockPatches = useRef(new Map<string, BlockPatch>());
  const profilePatch = useRef<ProfilePatch>({});
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const checkForm = useRef<HTMLFormElement>(null);
  const urlTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      setShared(localStorage.getItem("belinked:shared") === "1");
    } catch {
      setShared(false);
    }
  }, []);

  // ----- Blocks -----------------------------------------------------------

  const patchBlock = useCallback(
    (id: string, patch: BlockPatch, wait?: number) => {
      setBlocks((current) => current.map((block) => (block.id === id ? applyPatch(block, patch) : block)));
      const pending = blockPatches.current.get(id) || {};
      blockPatches.current.set(id, { ...pending, ...patch, metadata: patch.metadata || pending.metadata ? { ...pending.metadata, ...patch.metadata } : undefined });
      schedule(
        `block:${id}`,
        async () => {
          const toSave = blockPatches.current.get(id);
          blockPatches.current.delete(id);
          if (!toSave) return { ok: true };
          const result = await updateBlock(id, toSave);
          setErrors((current) => {
            const next = { ...current };
            if (result.ok) delete next[id];
            else next[id] = result.error;
            return next;
          });
          return result;
        },
        wait
      );
    },
    [schedule]
  );

  const persistOrder = useCallback(
    async (next: EditorBlock[]) => {
      const result = await track(saveBlockLayoutAction(rowsFromOrder(next)));
      if (!result.ok) toast(result.error || "Could not save the new order.", { tone: "error" });
    },
    [toast, track]
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= blocks.length || from === to) return;
      const next = [...blocks];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setBlocks(next);
      void persistOrder(next);
    },
    [blocks, persistOrder]
  );

  function remove(block: EditorBlock) {
    const index = blocks.findIndex((item) => item.id === block.id);
    setBlocks((current) => current.filter((item) => item.id !== block.id));
    const timer = setTimeout(async () => {
      deleteTimers.current.delete(block.id);
      const result = await track(deleteBlock(block.id));
      if (!result.ok) toast(result.error, { tone: "error" });
    }, 5000);
    deleteTimers.current.set(block.id, timer);
    toast(`Deleted “${block.title}”`, {
      tone: "info",
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer);
          deleteTimers.current.delete(block.id);
          setBlocks((current) => {
            const next = [...current];
            next.splice(Math.min(index, next.length), 0, block);
            return next;
          });
        }
      }
    });
  }

  // Deletions are delayed for undo; commit them if the editor unmounts first.
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => {
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        void deleteBlock(id);
      }
    };
  }, []);

  async function duplicate(block: EditorBlock) {
    const result = await track(duplicateBlock(block.id));
    if (!result.ok) return toast(result.error, { tone: "error" });
    setBlocks((current) => {
      const index = current.findIndex((item) => item.id === block.id);
      const next = [...current];
      next.splice(index + 1, 0, result.data);
      return next;
    });
    setHighlight(result.data.id);
    toast("Duplicated. The copy is hidden until you switch it on.");
  }

  const [fetchingThumbs, setFetchingThumbs] = useState<Set<string>>(() => new Set());

  /** Pulls the linked page's preview image into the block (see autoThumbnail modes). */
  const fillThumbnail = useCallback(
    async (id: string, mode: "auto" | "missing" | "refresh" = "auto") => {
      setFetchingThumbs((current) => new Set(current).add(id));
      try {
        const result = await autoThumbnail(id, mode);
        if (!result.ok) {
          if (mode === "refresh") toast(result.error, { tone: "error" });
          return false;
        }
        if (result.data.found) {
          const { imageUrl, metadata } = result.data.block;
          setBlocks((current) => current.map((block) => (block.id === id ? { ...block, imageUrl, metadata } : block)));
          if (mode === "refresh") toast("Thumbnail updated");
        }
        return result.data.found;
      } catch {
        if (mode === "refresh") toast("Couldn't fetch a thumbnail right now.", { tone: "error" });
        return false;
      } finally {
        setFetchingThumbs((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    },
    [toast]
  );

  /** After a URL edit is saved, refresh an automatic thumbnail (never an uploaded one). */
  const urlChanged = useCallback(
    async (id: string) => {
      await flush(`block:${id}`);
      void fillThumbnail(id);
    },
    [fillThumbnail, flush]
  );

  async function fillMissingThumbnails() {
    const targets = blocks.filter((block) => THUMBNAIL_TYPES.has(block.type) && !block.imageUrl && /^https?:\/\//.test(block.url || ""));
    if (!targets.length) return toast("Every link already has a thumbnail.", { tone: "info" });
    toast(`Fetching thumbnails for ${targets.length} link${targets.length === 1 ? "" : "s"}…`, { tone: "info" });
    let found = 0;
    const queue = [...targets];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (let block = queue.shift(); block; block = queue.shift()) if (await fillThumbnail(block.id, "missing")) found += 1;
      })
    );
    toast(found ? `Added ${found} thumbnail${found === 1 ? "" : "s"}${found < targets.length ? `; ${targets.length - found} page${targets.length - found === 1 ? "" : "s"} had no image` : ""}.` : "None of those pages had an image to use.", { tone: found ? "success" : "info" });
  }

  function created(block: EditorBlock) {
    if (THUMBNAIL_TYPES.has(block.type) && block.url && !block.imageUrl) void fillThumbnail(block.id);
    setBlocks((current) => [...current, block]);
    setAddOpen({ open: false });
    setHighlight(block.id);
    toast(`${blockTypeLabels[block.type]} added`);
    requestAnimationFrame(() => document.getElementById(`block-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2200);
    return () => clearTimeout(timer);
  }, [highlight]);

  // ----- Profile & socials -------------------------------------------------

  const changeProfile = useCallback(
    (patch: Partial<EditorProfile>) => {
      setProfile((current) => ({ ...current, ...patch }));
      profilePatch.current = { ...profilePatch.current, ...(patch as ProfilePatch) };
      schedule("profile", async () => {
        const toSave = profilePatch.current;
        profilePatch.current = {};
        const result = await updateProfile(toSave);
        if (!result.ok) toast(result.error, { tone: "error" });
        return result;
      });
    },
    [schedule, toast]
  );

  async function uploadAvatar(file: File) {
    const result = await track(uploadMedia(file, "profile"));
    if (!result.ok) return toast(result.error, { tone: "error" });
    changeProfile({ avatarUrl: result.data });
    await flush("profile");
    toast("Profile picture updated");
  }

  async function addSocialLink(url: string) {
    const result = await track(addSocial(url));
    if (!result.ok) {
      toast(result.error, { tone: "error" });
      return false;
    }
    setSocials((current) => [...current, result.data]);
    toast(`${result.data.label} added`);
    return true;
  }

  function changeSocial(id: string, patch: Partial<EditorSocial>) {
    setSocials((current) => current.map((social) => (social.id === id ? { ...social, ...patch } : social)));
    void track(updateSocial(id, patch)).then((result) => !result.ok && toast(result.error, { tone: "error" }));
  }

  function removeSocial(id: string) {
    setSocials((current) => current.filter((social) => social.id !== id));
    void track(deleteSocial(id));
  }

  function moveSocial(id: string, direction: -1 | 1) {
    const index = socials.findIndex((social) => social.id === id);
    const target = index + direction;
    if (target < 0 || target >= socials.length) return;
    const next = [...socials];
    [next[index], next[target]] = [next[target], next[index]];
    setSocials(next);
    void track(reorderSocials(next.map((social) => social.id)));
  }

  function changePlacement(value: SocialPlacement) {
    setPlacement(value);
    void track(setSocialPlacement(value));
  }

  // ----- Preview data -------------------------------------------------------

  const preview: PreviewData = useMemo(
    () => ({ profile, blocks, socials, placement, settings: props.settings, footerText: props.footerText }),
    [profile, blocks, socials, placement, props.settings, props.footerText]
  );

  const detailsBlock = detailsId ? blocks.find((block) => block.id === detailsId) || null : null;

  // ----- Onboarding ----------------------------------------------------------

  const steps = [
    { label: "Add a profile picture", done: Boolean(profile.avatarUrl), action: () => setProfileDialog({ open: true, tab: "profile" }) },
    { label: "Write a short bio", done: Boolean(profile.bio.trim()), action: () => setProfileDialog({ open: true, tab: "profile" }) },
    { label: "Add your first link", done: blocks.some((block) => block.type === "LINK"), action: () => setAddOpen({ open: true, item: "link" }) },
    { label: "Pick a theme", done: props.onboarding.themeChosen, href: "/admin/appearance" },
    { label: "Publish and share", done: isPublished && shared, action: () => (isPublished ? share() : setPublished(true)) }
  ];
  const completed = steps.filter((step) => step.done).length;

  function share() {
    try {
      localStorage.setItem("belinked:shared", "1");
    } catch {
      // ignore
    }
    setShared(true);
    openShare();
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:py-8 xl:pb-8">
        <div className="mx-auto grid max-w-[680px] grid-cols-[minmax(0,1fr)] gap-5">
          {!onboardingDismissed && completed < steps.length ? (
            <section aria-label="Get your page ready" className="panel grid gap-3 border-[#e2d9ff] bg-gradient-to-br from-white to-[#f6f2ff]">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--ui-accent)] text-white" aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-black">Get your page ready</h2>
                  <p className="text-sm text-muted">
                    {completed} of {steps.length} done. Skip anything you don’t need.
                  </p>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Hide setup checklist"
                  onClick={() => {
                    setOnboardingDismissed(true);
                    void dismissOnboarding();
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#e8e2fb]">
                <div className="h-full rounded-full bg-[var(--ui-accent)] transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
              </div>
              <ol className="grid gap-1.5 sm:grid-cols-2">
                {steps.map((step) =>
                  step.href && !step.done ? (
                    <li key={step.label}>
                      <Link href={step.href} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold hover:bg-white">
                        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#cfc4f5]" aria-hidden="true" />
                        {step.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={step.label}>
                      <button disabled={step.done} onClick={step.action} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-semibold ${step.done ? "text-muted line-through" : "hover:bg-white"}`}>
                        {step.done ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--ui-success)] text-white" aria-hidden="true">
                            <Check size={12} />
                          </span>
                        ) : (
                          <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#cfc4f5]" aria-hidden="true" />
                        )}
                        {step.label}
                        {step.done ? <span className="sr-only">(done)</span> : null}
                      </button>
                    </li>
                  )
                )}
              </ol>
            </section>
          ) : null}

          {/* Profile header: click anywhere to edit */}
          <button
            type="button"
            onClick={() => setProfileDialog({ open: true, tab: "profile" })}
            className="group panel flex items-center gap-4 text-left transition hover:border-[var(--ui-border-strong)] hover:shadow-md"
            aria-label="Edit profile: picture, name, bio"
          >
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#ececea]">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-2xl font-black text-muted">{profile.displayName.slice(0, 1).toUpperCase() || "?"}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-black">{profile.displayName || "Add your name"}</span>
              <span className={`mt-1 line-clamp-2 block text-sm ${profile.bio ? "" : "text-muted italic"}`}>{profile.bio || "Add a bio so visitors know who you are"}</span>
            </span>
            <span className="btn-secondary btn-sm pointer-events-none hidden shrink-0 group-hover:bg-[#f5f5f3] sm:inline-flex">
              <Pencil size={13} aria-hidden="true" /> Edit
            </span>
          </button>

          <div className="-mt-2 flex flex-wrap items-center gap-1.5 px-1">
            {socials.map((social) => (
              <button key={social.id} onClick={() => setProfileDialog({ open: true, tab: "socials" })} className={`grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[var(--ui-border)] ${social.isVisible ? "" : "opacity-40"}`} aria-label={`Edit ${social.label}`} title={social.label}>
                <SocialGlyph social={social} className="h-4 w-4" />
              </button>
            ))}
            <button onClick={() => setProfileDialog({ open: true, tab: "socials" })} className="btn-ghost btn-sm text-muted">
              <Plus size={14} aria-hidden="true" /> {socials.length ? "Socials" : "Add social icons"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-accent min-h-12 flex-1 text-base" onClick={() => setAddOpen({ open: true })}>
              <Plus size={20} aria-hidden="true" /> Add
            </button>
            <Menu label="More page tools" trigger={<MoreVertical size={18} aria-hidden="true" />}>
              {(close) => (
                <>
                  <MenuItem
                    icon={<Check size={15} />}
                    onSelect={() => {
                      close();
                      checkForm.current?.requestSubmit();
                      toast("Checking your links… this can take a few seconds.", { tone: "info" });
                    }}
                  >
                    Check for broken links
                  </MenuItem>
                  <MenuItem
                    icon={<Upload size={15} />}
                    onSelect={() => {
                      close();
                      setImportOpen(true);
                    }}
                  >
                    Import links (CSV)
                  </MenuItem>
                  <MenuItem
                    icon={<Download size={15} />}
                    onSelect={() => {
                      close();
                      window.location.href = "/api/export?type=links&format=csv";
                    }}
                  >
                    Export links (CSV)
                  </MenuItem>
                  <MenuItem
                    icon={<ImageDown size={15} />}
                    onSelect={() => {
                      close();
                      void fillMissingThumbnails();
                    }}
                  >
                    Fetch missing thumbnails
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
          <form ref={checkForm} action={checkLinksAction} hidden />

          {blocks.length ? (
            <SortableBlocks
              blocks={blocks}
              errors={errors}
              health={props.health}
              clicks={props.clicks}
              highlight={highlight}
              onMove={move}
              onPatch={patchBlock}
              onOpenDetails={setDetailsId}
              onDuplicate={duplicate}
              onRemove={remove}
              onUrlChanged={urlChanged}
              fetchingThumbs={fetchingThumbs}
            />
          ) : (
            <section className="grid justify-items-center gap-3 rounded-3xl border-2 border-dashed border-[var(--ui-border-strong)] px-6 py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm" aria-hidden="true">
                <Plus size={24} />
              </span>
              <h2 className="text-xl font-black">Your page is empty</h2>
              <p className="max-w-sm text-sm text-muted">Add your first link to start building your page. It appears in the preview straight away.</p>
              <button className="btn-accent mt-1" onClick={() => setAddOpen({ open: true, item: "link" })}>
                <Plus size={16} aria-hidden="true" /> Add link
              </button>
            </section>
          )}
        </div>
      </div>

      <aside aria-label="Preview" className="sticky top-16 hidden h-[calc(100vh-4rem)] border-l border-[var(--ui-border)] bg-[#ebebe7] px-6 py-6 xl:block">
        <LivePreview data={preview} />
      </aside>

      <button className="btn fixed bottom-20 right-4 z-20 shadow-xl md:bottom-6 xl:hidden" onClick={() => setPreviewOpen(true)}>
        <Eye size={16} aria-hidden="true" /> Preview
      </button>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" size="lg">
        <div className="h-[70vh]">
          <LivePreview data={preview} />
        </div>
      </Dialog>

      <AddContentDialog
        open={addOpen.open}
        initialItem={addOpen.item}
        onClose={() => setAddOpen({ open: false })}
        onCreated={created}
        onOpenSocials={() => setProfileDialog({ open: true, tab: "socials" })}
        onOpenShare={share}
      />
      <ProfileDialog
        open={profileDialog.open}
        tab={profileDialog.tab}
        onTabChange={(tab) => setProfileDialog({ open: true, tab })}
        onClose={() => {
          setProfileDialog((current) => ({ ...current, open: false }));
          void flush("profile");
        }}
        profile={profile}
        onProfileChange={changeProfile}
        onAvatarUpload={uploadAvatar}
        socials={socials}
        placement={placement}
        onPlacementChange={changePlacement}
        onAddSocial={addSocialLink}
        onUpdateSocial={changeSocial}
        onRemoveSocial={removeSocial}
        onMoveSocial={moveSocial}
      />
      <BlockDetailsDialog
        key={detailsId || "none"}
        block={detailsBlock}
        clicks={detailsBlock ? props.clicks[detailsBlock.id] : undefined}
        onClose={() => {
          if (detailsId) void flush(`block:${detailsId}`);
          setDetailsId(null);
        }}
        onChange={(patch) => {
          if (!detailsId) return;
          patchBlock(detailsId, patch);
          if ("url" in patch) {
            // Refetch an automatic thumbnail once the new URL has settled.
            const id = detailsId;
            window.clearTimeout(urlTimer.current);
            urlTimer.current = window.setTimeout(() => void urlChanged(id), 1200);
          }
        }}
        onFetchThumbnail={detailsId && detailsBlock && THUMBNAIL_TYPES.has(detailsBlock.type) ? () => fillThumbnail(detailsId, "refresh") : undefined}
        fetchingThumbnail={Boolean(detailsId && fetchingThumbs.has(detailsId))}
      />
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Import links" description="Upload a CSV with title, url and (optional) description columns. Imported links start hidden so you can review them.">
        <form action={importLinksCsvAction} encType="multipart/form-data" className="grid gap-4">
          <input className="input" type="file" name="csvFile" accept=".csv,text/csv" required aria-label="CSV file" />
          <div className="flex flex-wrap justify-between gap-2">
            <a className="btn-ghost" download href="/api/export?type=blocks-template&format=csv">
              <Download size={14} aria-hidden="true" /> Download template
            </a>
            <button className="btn-accent">Import</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable list (pointer events: mouse, touch and pen) + keyboard reordering
// ---------------------------------------------------------------------------

type DragState = { id: string; from: number; over: number; startY: number; dy: number; tops: number[]; heights: number[] };

function SortableBlocks({
  blocks,
  errors,
  health,
  clicks,
  highlight,
  onMove,
  onPatch,
  onOpenDetails,
  onDuplicate,
  onRemove,
  onUrlChanged,
  fetchingThumbs
}: {
  blocks: EditorBlock[];
  errors: Record<string, string>;
  health: Props["health"];
  clicks: Props["clicks"];
  highlight: string | null;
  onMove: (from: number, to: number) => void;
  onPatch: (id: string, patch: BlockPatch, wait?: number) => void;
  onOpenDetails: (id: string) => void;
  onDuplicate: (block: EditorBlock) => void;
  onRemove: (block: EditorBlock) => void;
  onUrlChanged: (id: string) => void;
  fetchingThumbs: Set<string>;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  // Handlers read the ref so a fast release never sees a stale position.
  const dragRef = useRef<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  const GAP = 12;

  function start(event: React.PointerEvent, id: string, index: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const rects = blocks.map((block) => refs.current.get(block.id)?.getBoundingClientRect());
    updateDrag({
      id,
      from: index,
      over: index,
      startY: event.clientY + window.scrollY,
      dy: 0,
      tops: rects.map((rect) => (rect?.top || 0) + window.scrollY),
      heights: rects.map((rect) => rect?.height || 0)
    });
  }

  function moveDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.clientY < 90) window.scrollBy(0, -14);
    if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
    const dy = event.clientY + window.scrollY - drag.startY;
    const center = drag.tops[drag.from] + drag.heights[drag.from] / 2 + dy;
    let over = drag.from;
    for (let index = 0; index < drag.tops.length; index += 1) {
      const mid = drag.tops[index] + drag.heights[index] / 2;
      if (index < drag.from && center < mid) {
        over = index;
        break;
      }
    }
    if (over === drag.from) {
      for (let index = drag.tops.length - 1; index > drag.from; index -= 1) {
        if (center > drag.tops[index] + drag.heights[index] / 2) {
          over = index;
          break;
        }
      }
    }
    updateDrag({ ...drag, dy, over });
  }

  function end() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.over !== drag.from) {
      onMove(drag.from, drag.over);
      setAnnouncement(`Moved to position ${drag.over + 1} of ${blocks.length}.`);
    }
    updateDrag(null);
  }

  function shift(index: number) {
    if (!drag || index === drag.from) return 0;
    const size = drag.heights[drag.from] + GAP;
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return -size;
    if (drag.from > drag.over && index >= drag.over && index < drag.from) return size;
    return 0;
  }

  // No accidental text selection while dragging.
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [isDragging]);

  const now = Date.now();

  return (
    <>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
      <ul className="grid gap-3" aria-label="Your links and blocks">
        {blocks.map((block, index) => {
          const dragging = drag?.id === block.id;
          const Icon = iconForBlock(block.type, block.url);
          const hidden = block.status !== "ACTIVE";
          const scheduled = block.startsAt && new Date(block.startsAt).getTime() > now;
          const expired = block.endsAt && new Date(block.endsAt).getTime() < now;
          const issue = health[block.id] && !health[block.id].ok ? health[block.id] : null;
          const showUrl = URL_TYPES.has(block.type);
          const side = groupSize(block);
          const isImage = block.imageUrl && !/\.(mp4|webm|ogv|mov)$/i.test(block.imageUrl);
          return (
            <li
              key={block.id}
              id={`block-${block.id}`}
              ref={(element) => {
                if (element) refs.current.set(block.id, element);
                else refs.current.delete(block.id);
              }}
              className="relative scroll-mt-24"
              // Transforms create a stacking context that would hide an open ⋮ menu
              // under the next card, so they are only applied while dragging.
              style={
                drag
                  ? {
                      transform: dragging ? `translateY(${drag.dy}px) scale(1.02)` : `translateY(${shift(index)}px)`,
                      transition: dragging ? "none" : "transform 160ms ease",
                      zIndex: dragging ? 20 : undefined
                    }
                  : undefined
              }
            >
              <div
                className={`flex items-stretch gap-1 rounded-3xl border bg-white py-3 pl-1.5 pr-2 transition-shadow sm:gap-2 ${dragging ? "border-[var(--ui-accent)] shadow-2xl" : "border-[var(--ui-border)] shadow-sm"} ${hidden ? "border-dashed" : ""} ${highlight === block.id ? "ui-flash" : ""}`}
              >
                <button
                  type="button"
                  className="grid w-8 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-[var(--ui-subtle)] hover:bg-[#f3f3f1] hover:text-[var(--ui-ink)] active:cursor-grabbing"
                  aria-label={`Reorder “${block.title}”. Position ${index + 1} of ${blocks.length}. Use arrow keys to move.`}
                  onPointerDown={(event) => start(event, block.id, index)}
                  onPointerMove={moveDrag}
                  onPointerUp={end}
                  onPointerCancel={() => updateDrag(null)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                      event.preventDefault();
                      const to = index + (event.key === "ArrowUp" ? -1 : 1);
                      if (to < 0 || to >= blocks.length) return;
                      onMove(index, to);
                      setAnnouncement(`“${block.title}” moved to position ${to + 1} of ${blocks.length}.`);
                      requestAnimationFrame(() => (document.querySelector(`#block-${block.id} [aria-label^="Reorder"]`) as HTMLElement | null)?.focus());
                    }
                  }}
                >
                  <GripVertical size={18} aria-hidden="true" />
                </button>

                <button type="button" onClick={() => onOpenDetails(block.id)} className={`grid h-11 w-11 shrink-0 place-items-center self-center overflow-hidden rounded-xl bg-[#f1f1ee] ${hidden ? "opacity-50" : ""}`} aria-label={`Change image and settings for “${block.title}”`}>
                  {fetchingThumbs.has(block.id) ? (
                    <Loader2 size={18} className="animate-spin text-muted" aria-label="Fetching thumbnail" />
                  ) : isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.imageUrl || ""} alt="" className="h-full w-full object-cover" />
                  ) : isPackIcon(block.icon) ? (
                    <PackIconGlyph id={block.icon} className="h-[18px] w-[18px]" />
                  ) : (
                    <Icon size={18} aria-hidden="true" />
                  )}
                </button>

                <div className={`min-w-0 flex-1 ${hidden ? "opacity-60" : ""}`}>
                  {block.type === "SEPARATOR" ? (
                    <p className="flex h-full items-center px-2 text-sm font-bold text-muted">
                      <span className="mr-3 h-px w-8 bg-current" aria-hidden="true" /> Divider
                    </p>
                  ) : (
                    <input
                      className="input-inline text-[15px] font-bold"
                      value={block.title}
                      maxLength={120}
                      aria-label={`${blockTypeLabels[block.type]} title`}
                      onChange={(event) => onPatch(block.id, { title: event.target.value })}
                    />
                  )}
                  {block.type === "TEXT" ? (
                    <input
                      className="input-inline text-sm text-muted"
                      value={block.description || ""}
                      placeholder="Write something…"
                      maxLength={400}
                      aria-label="Text"
                      onChange={(event) => onPatch(block.id, { description: event.target.value || null })}
                    />
                  ) : null}
                  {showUrl ? (
                    <input
                      className="input-inline text-sm text-muted"
                      defaultValue={block.url || ""}
                      key={`${block.id}-${block.url}`}
                      placeholder={block.type === "IMAGE" ? "Add a link (optional)" : "https://"}
                      aria-label={`${blockTypeLabels[block.type]} URL`}
                      onBlur={(event) => {
                        const raw = event.target.value;
                        const next = block.type === "CONTACT" ? normalizeContactUrl(raw) : normalizeWebUrl(raw);
                        if ((next || null) !== (block.url || null)) {
                          onPatch(block.id, { url: next || null }, 0);
                          if (THUMBNAIL_TYPES.has(block.type)) onUrlChanged(block.id);
                        }
                      }}
                      onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
                      title={displayUrl(block.url)}
                    />
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 px-2">
                    {block.type !== "LINK" ? <span className="badge badge-muted">{blockTypeLabels[block.type]}</span> : null}
                    {hidden ? <span className="badge badge-muted">{block.status === "ARCHIVED" ? "Archived" : "Hidden"}</span> : null}
                    {scheduled ? <span className="badge badge-warn">Scheduled</span> : null}
                    {expired ? <span className="badge badge-muted">Expired</span> : null}
                    {block.featured ? <span className="badge badge-accent">Featured</span> : null}
                    {side > 1 ? <span className="badge badge-accent">Side by side ×{side}</span> : null}
                    {issue ? (
                      <span className="badge badge-danger" title={issue.message}>
                        <CircleAlert size={11} aria-hidden="true" /> Link problem
                      </span>
                    ) : null}
                    {clicks[block.id] ? (
                      <span className="badge badge-muted" title="Clicks in the last 30 days">
                        <BarChart3 size={11} aria-hidden="true" /> {clicks[block.id]} {clicks[block.id] === 1 ? "click" : "clicks"}
                      </span>
                    ) : null}
                  </div>
                  {errors[block.id] ? (
                    <p role="alert" className="mt-1 px-2 text-xs font-semibold text-[var(--ui-danger)]">
                      Not saved: {errors[block.id]}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end justify-between gap-2 sm:flex-row sm:items-center">
                  <Switch checked={block.status === "ACTIVE"} onChange={(on) => onPatch(block.id, { status: on ? "ACTIVE" : "HIDDEN" }, 0)} label={block.status === "ACTIVE" ? `Hide “${block.title}”` : `Show “${block.title}”`} />
                  <Menu label={`More options for “${block.title}”`} trigger={<MoreVertical size={18} aria-hidden="true" />}>
                    {(close) => (
                      <>
                        <MenuItem icon={<Settings2 size={15} />} onSelect={() => (close(), onOpenDetails(block.id))}>
                          Edit details
                        </MenuItem>
                        <MenuItem icon={<Copy size={15} />} onSelect={() => (close(), onDuplicate(block))}>
                          Duplicate
                        </MenuItem>
                        {block.status === "ACTIVE" ? (
                          <MenuItem icon={<EyeOff size={15} />} onSelect={() => (close(), onPatch(block.id, { status: "HIDDEN" }, 0))}>
                            Hide from page
                          </MenuItem>
                        ) : (
                          <MenuItem icon={<Eye size={15} />} onSelect={() => (close(), onPatch(block.id, { status: "ACTIVE" }, 0))}>
                            Show on page
                          </MenuItem>
                        )}
                        <MenuItem icon={<BarChart3 size={15} />} onSelect={() => (close(), (window.location.href = "/admin/analytics"))}>
                          View analytics
                        </MenuItem>
                        <div className="my-1 h-px bg-[var(--ui-border)]" />
                        <MenuItem danger icon={<Trash2 size={15} />} onSelect={() => (close(), onRemove(block))}>
                          Delete
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
