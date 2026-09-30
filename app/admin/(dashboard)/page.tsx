import Link from "next/link";
import { BarChart3, Eye, Link2, MousePointerClick, Users } from "lucide-react";
import type { ReactNode } from "react";
import { togglePublishedAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { isBlockVisible } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="panel grid gap-1">
      <span className="flex items-center gap-2 text-sm text-black/60">{icon}{label}</span>
      <strong className="text-3xl font-black">{value}</strong>
    </div>
  );
}

export default async function AdminHome() {
  const owner = await requireOwner();
  const [profile, blocks, socialCount, summary, recent, base] = await Promise.all([
    prisma.profile.findFirstOrThrow(),
    prisma.block.findMany({ select: { status: true, startsAt: true, endsAt: true, type: true } }),
    prisma.socialIcon.count(),
    analyticsSummary(30),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    siteUrl()
  ]);
  const liveBlocks = blocks.filter((block) => isBlockVisible(block)).length;
  const checklist = [
    { done: Boolean(profile.avatarUrl), label: "Add a profile picture", href: "/admin/profile" },
    { done: Boolean(profile.bio.trim()), label: "Write a short bio", href: "/admin/profile" },
    { done: blocks.some((block) => block.type === "LINK"), label: "Add your first link", href: "/admin/blocks" },
    { done: socialCount > 0, label: "Add social icons", href: "/admin/socials" },
    { done: owner.totpEnabled, label: "Turn on two-factor authentication", href: "/admin/settings#security" }
  ];
  const remaining = checklist.filter((item) => !item.done);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Hi, {owner.displayName.split(" ")[0]}</h1>
          <p className="text-sm text-black/60">Your page lives at <a className="font-semibold underline" href="/" target="_blank" rel="noopener">{base}/</a></p>
        </div>
        <a className="btn-secondary" href="/" target="_blank" rel="noopener"><Eye size={16} aria-hidden="true" /> View page</a>
      </div>

      <section className={`panel flex flex-wrap items-center justify-between gap-3 ${profile.isPublished ? "" : "ring-2 ring-amber-300/60"}`}>
        <div className="grid gap-1">
          <strong className="text-lg">{profile.isPublished ? "Your page is live" : "Your page is unpublished"}</strong>
          <span className="text-sm text-black/60">
            {profile.isPublished ? `${liveBlocks} of ${blocks.length} blocks are visible to visitors.` : "Visitors see a 'not published' message. You can still preview it while signed in."}
            {profile.priorityRedirectOn ? " A profile redirect is currently on." : ""}
          </span>
        </div>
        <form action={togglePublishedAction}>
          <SubmitButton className={profile.isPublished ? "btn-secondary" : "btn"} pendingLabel="Updating...">{profile.isPublished ? "Unpublish" : "Publish now"}</SubmitButton>
        </form>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Views (30d)" value={summary.views} icon={<BarChart3 size={16} aria-hidden="true" />} />
        <Stat label="Visitors (30d)" value={summary.visitors} icon={<Users size={16} aria-hidden="true" />} />
        <Stat label="Clicks (30d)" value={summary.clicks} icon={<MousePointerClick size={16} aria-hidden="true" />} />
        <Stat label="Click-through" value={`${summary.ctr}%`} icon={<Link2 size={16} aria-hidden="true" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Top links</h2>
            <Link className="text-sm font-semibold underline" href="/admin/analytics">All analytics</Link>
          </div>
          <div className="grid gap-2">
            {summary.topLinks.length ? (
              summary.topLinks.slice(0, 5).map((link) => (
                <p key={link.label} className="flex justify-between gap-3 border-b border-black/10 py-2">
                  <span className="truncate">{link.label}</span>
                  <strong>{link.count}</strong>
                </p>
              ))
            ) : (
              <p className="text-sm text-black/60">No clicks yet. Share your page to start collecting data.</p>
            )}
          </div>
        </section>

        {remaining.length ? (
          <section className="panel">
            <h2 className="mb-3 text-xl font-black">Finish setting up</h2>
            <ul className="grid gap-2">
              {remaining.map((item) => (
                <li key={item.label}>
                  <Link className="flex items-center justify-between rounded-md border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-white/5" href={item.href}>
                    {item.label} <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel">
            <h2 className="mb-3 text-xl font-black">Recent activity</h2>
            <ul className="grid gap-1 text-sm">
              {recent.map((log) => (
                <li key={log.id} className="flex justify-between gap-3 border-b border-black/10 py-2">
                  <span>{log.action.replaceAll("_", " ").replaceAll(".", " · ")}</span>
                  <time className="shrink-0 text-black/55" dateTime={log.createdAt.toISOString()}>{log.createdAt.toISOString().slice(0, 10)}</time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
