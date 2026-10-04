"use client";

import type { SocialIcon } from "@prisma/client";
import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PublicProfile } from "@/components/PublicProfile";
import { blockFromEditor, type EditorBlock, type EditorProfile, type EditorSocial } from "@/lib/editor-types";
import { publicBlocks, publicSocials } from "@/lib/public-data";
import type { SocialPlacement } from "@/lib/socials";
import { safeThemeMediaUrl, type ThemeSettings } from "@/lib/themes";

export type PreviewData = {
  profile: EditorProfile;
  blocks: EditorBlock[];
  socials: EditorSocial[];
  placement: SocialPlacement;
  settings: ThemeSettings;
  footerText?: string;
};

const DEVICES = {
  mobile: { width: 390, height: 800 },
  desktop: { width: 1280, height: 820 }
} as const;

/**
 * Renders the real public page component from editor state, so every edit shows up
 * instantly. The page is scaled into a phone frame or a desktop browser frame.
 */
export function LivePreview({ data, compact = false }: { data: PreviewData; compact?: boolean }) {
  const [device, setDevice] = useState<keyof typeof DEVICES>("mobile");
  const holder = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 320, height: 640 });

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const size = DEVICES[device];
  const scale = Math.min(1, (available.width - (device === "mobile" ? 24 : 0)) / size.width, device === "mobile" ? (available.height - 24) / size.height : 1);

  const props = useMemo(
    () => ({
      profile: {
        id: data.profile.id,
        displayName: data.profile.displayName || "Your name",
        bio: data.profile.bio,
        badge: data.profile.badge,
        avatarUrl: safeThemeMediaUrl(data.profile.avatarUrl) || null,
        logoUrl: safeThemeMediaUrl(data.profile.logoUrl) || null,
        cookieNoticeEnabled: data.profile.cookieNoticeEnabled
      },
      blocks: publicBlocks(data.blocks.map(blockFromEditor)),
      socials: publicSocials(data.socials.map((social) => ({ ...social, createdAt: new Date(0), updatedAt: new Date(0) }) as SocialIcon))
    }),
    [data.profile, data.blocks, data.socials]
  );

  const frameBackground = {
    background: data.settings.background,
    backgroundImage: data.settings.backgroundImage ? `url("${data.settings.backgroundImage.replace(/["\\\n]/g, "")}")` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center"
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      {!compact ? (
        <div className="segmented" role="group" aria-label="Preview device">
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className="flex items-center gap-1.5">
            <Smartphone size={14} aria-hidden="true" /> Mobile
          </button>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className="flex items-center gap-1.5">
            <Monitor size={14} aria-hidden="true" /> Desktop
          </button>
        </div>
      ) : null}
      <div ref={holder} className="relative flex min-h-0 w-full flex-1 justify-center" aria-label="Live preview of your page" role="region">
        <div
          className={`relative shrink-0 ${device === "mobile" ? "rounded-[44px] border-[10px] border-[#16161d] shadow-2xl" : "rounded-xl border border-[var(--ui-border-strong)] shadow-xl"} overflow-hidden bg-[#16161d]`}
          style={{ width: size.width * scale + (device === "mobile" ? 20 : 2), height: size.height * scale + (device === "mobile" ? 20 : 2) + (device === "desktop" ? 28 : 0) }}
        >
          {device === "desktop" ? (
            <div className="flex h-7 items-center gap-1.5 bg-[#ececea] px-3" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6159]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c941]" />
            </div>
          ) : null}
          <div
            className="origin-top-left overflow-y-auto overflow-x-hidden"
            style={{ width: size.width, height: size.height, transform: `scale(${scale})`, ...frameBackground }}
          >
            <div inert style={{ transform: "translateZ(0)", minHeight: size.height }}>
              <PublicProfile
                profile={props.profile}
                blocks={props.blocks}
                socials={props.socials}
                socialPlacement={data.placement}
                settings={data.settings}
                track={false}
                footerText={data.footerText}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
