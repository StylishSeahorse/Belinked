import Link from "next/link";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const days = Number(params.days || 30);
  const summary = await analyticsSummary(days);
  const events = await prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { block: true } });
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Analytics</h1>
        <div className="flex gap-2"><Link className="btn-secondary" href="/api/export?type=analytics&format=csv">CSV</Link><Link className="btn-secondary" href="/api/export?type=analytics&format=json">JSON</Link></div>
      </div>
      <form className="flex max-w-xs gap-2"><select className="input" name="days" defaultValue={days}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select><button className="btn-secondary">Filter</button></form>
      <div className="grid gap-4 md:grid-cols-3"><div className="panel"><strong className="text-3xl">{summary.views}</strong><p>Views</p></div><div className="panel"><strong className="text-3xl">{summary.clicks}</strong><p>Clicks</p></div><div className="panel"><strong className="text-3xl">{summary.ctr}%</strong><p>CTR</p></div></div>
      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm"><thead><tr><th>Time</th><th>Type</th><th>Target</th><th>Referrer</th><th>Device</th><th>Bot</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-black/10"><td>{event.createdAt.toLocaleString()}</td><td>{event.type}</td><td>{event.block?.title || event.shortCode || event.path}</td><td>{event.referrer}</td><td>{event.device}</td><td>{event.isBot ? "Yes" : "No"}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
