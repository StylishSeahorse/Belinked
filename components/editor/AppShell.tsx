"use client";

import { BarChart3, ExternalLink, Link2, LogOut, MoreHorizontal, Palette, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { logoutAction } from "@/app/actions";
import { setPublished as setPublishedAction } from "@/app/editor-actions";
import { ShareDialog } from "@/components/editor/ShareDialog";
import { FeedbackProvider, SaveIndicator, useFeedback } from "@/components/ui/feedback";
import { Menu, MenuItem } from "@/components/ui/overlay";

export const NAV = [
  { href: "/admin", label: "Links", icon: Link2 },
  { href: "/admin/appearance", label: "Appearance", icon: Palette },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings }
] as const;

type PageStatus = {
  isPublished: boolean;
  setPublished: (value: boolean) => Promise<void>;
  openShare: () => void;
  siteUrl: string;
};

const StatusContext = createContext<PageStatus | null>(null);

export function usePageStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error("usePageStatus must be used inside <AppShell>");
  return context;
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function PublishButton() {
  const { isPublished, setPublished } = usePageStatus();
  return (
    <Menu
      label={isPublished ? "Page is published" : "Page is unpublished"}
      triggerClassName="rounded-full"
      trigger={
        <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--ui-border-strong)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--ui-ink)]">
          <span className={`h-2 w-2 rounded-full ${isPublished ? "bg-[var(--ui-success)]" : "bg-[#b6b6ae]"}`} aria-hidden="true" />
          {isPublished ? "Published" : "Unpublished"}
        </span>
      }
    >
      {(close) => (
        <div className="grid w-64 gap-2 p-2">
          <p className="text-sm text-muted">{isPublished ? "Visitors can see your page." : "Only you can see your page while signed in."}</p>
          <button
            role="menuitem"
            className={isPublished ? "btn-secondary" : "btn-accent"}
            onClick={async () => {
              close();
              await setPublished(!isPublished);
            }}
          >
            {isPublished ? "Unpublish page" : "Publish page"}
          </button>
        </div>
      )}
    </Menu>
  );
}

function ShellInner({ children, displayName }: { children: ReactNode; displayName: string }) {
  const pathname = usePathname();
  const { openShare, siteUrl } = usePageStatus();

  return (
    <div className="admin-shell flex min-h-screen flex-col">
      <a href="#admin-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-[var(--ui-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <Link href="/admin" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--ui-ink)] text-sm text-white" aria-hidden="true">
              B
            </span>
            <span className="hidden sm:inline">Belinked</span>
          </Link>
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-[var(--ui-ink)] text-white" : "text-muted hover:bg-[#f0f0ed] hover:text-[var(--ui-ink)]"}`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline-flex">
              <SaveIndicator />
            </span>
            <PublishButton />
            <button className="btn-accent min-h-9 px-4 py-1.5" onClick={openShare}>
              <Share2 size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <Menu label="Account menu" trigger={<MoreHorizontal size={18} aria-hidden="true" />}>
              {(close) => (
                <>
                  <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted">{displayName}</p>
                  <MenuItem
                    icon={<ExternalLink size={15} />}
                    onSelect={() => {
                      close();
                      window.open(siteUrl, "_blank", "noopener");
                    }}
                  >
                    View my page
                  </MenuItem>
                  <form action={logoutAction}>
                    <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-[#f3f3f1]">
                      <LogOut size={15} aria-hidden="true" /> Sign out
                    </button>
                  </form>
                </>
              )}
            </Menu>
          </div>
        </div>
      </header>

      <main id="admin-content" className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[var(--ui-border)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${active ? "text-[var(--ui-accent)]" : "text-muted"}`}>
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function StatusProvider({ children, initialPublished, siteUrl }: { children: ReactNode; initialPublished: boolean; siteUrl: string }) {
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [shareOpen, setShareOpen] = useState(false);
  const { toast, track } = useFeedback();

  const setPublished = useCallback(
    async (value: boolean) => {
      setIsPublished(value);
      const result = await track(setPublishedAction(value));
      if (!result.ok) {
        setIsPublished(!value);
        toast(result.error, { tone: "error" });
        return;
      }
      toast(value ? "Your page is live 🎉" : "Your page is now unpublished", value ? { action: { label: "Share", onClick: () => setShareOpen(true) } } : undefined);
    },
    [toast, track]
  );

  return (
    <StatusContext.Provider value={{ isPublished, setPublished, openShare: () => setShareOpen(true), siteUrl }}>
      {children}
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} url={siteUrl} isPublished={isPublished} />
    </StatusContext.Provider>
  );
}

export function AppShell({ children, initialPublished, siteUrl, displayName }: { children: ReactNode; initialPublished: boolean; siteUrl: string; displayName: string }) {
  return (
    <FeedbackProvider>
      <StatusProvider initialPublished={initialPublished} siteUrl={siteUrl}>
        <ShellInner displayName={displayName}>{children}</ShellInner>
      </StatusProvider>
    </FeedbackProvider>
  );
}
