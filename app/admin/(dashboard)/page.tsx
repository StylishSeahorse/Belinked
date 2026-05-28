import Link from "next/link";
import { BarChart3, ExternalLink, Link2, Palette } from "lucide-react";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireOwner();
  const [blockCount, shortCount, summary] = await Promise.all([
    prisma.block.count(),
    prisma.shortLink.count(),
    analyticsSummary(30)
  ]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Dashboard</h1>
          <p className="text-sm text-black/60">Manage your local public profile and first-party data.</p>
        </div>
        <Link className="btn-secondary" href="/" target="_blank">
          <ExternalLink size={16} /> View public page
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="panel"><BarChart3 /><strong className="block text-2xl">{summary.views}</strong><span className="text-sm text-black/60">Views</span></div>
        <div className="panel"><Link2 /><strong className="block text-2xl">{summary.clicks}</strong><span className="text-sm text-black/60">Clicks</span></div>
        <div className="panel"><Palette /><strong className="block text-2xl">{summary.ctr}%</strong><span className="text-sm text-black/60">CTR</span></div>
        <div className="panel"><strong className="block text-2xl">{blockCount}</strong><span className="text-sm text-black/60">Blocks, {shortCount} short links</span></div>
      </div>
      <section className="panel">
        <h2 className="mb-3 text-xl font-black">Top links</h2>
        <div className="grid gap-2">
          {summary.topLinks.length ? summary.topLinks.map(([title, clicks]) => <p key={title} className="flex justify-between border-b border-black/10 py-2"><span>{title}</span><strong>{clicks}</strong></p>) : <p className="text-sm text-black/60">No clicks recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
