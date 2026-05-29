import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Download, Eye, MousePointerClick, Users } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CountItem = {
  label: string;
  count: number;
  share: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDelta(value: number, suffix = "") {
  if (value === 0) return `No change${suffix}`;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

function safeDays(value?: string) {
  const days = Number(value || 30);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

function MetricCard({
  label,
  value,
  delta,
  icon,
  suffix = "",
  tone = "cyan"
}: {
  label: string;
  value: string | number;
  delta: number;
  icon: ReactNode;
  suffix?: string;
  tone?: "cyan" | "emerald" | "violet" | "amber";
}) {
  const toneClass = {
    cyan: "from-cyan-400/20 text-cyan-100",
    emerald: "from-emerald-400/20 text-emerald-100",
    violet: "from-violet-400/20 text-violet-100",
    amber: "from-amber-400/20 text-amber-100"
  }[tone];
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <section className="panel overflow-hidden">
      <div className={`-mx-5 -mt-5 mb-4 flex items-center justify-between bg-gradient-to-br ${toneClass} to-transparent px-5 py-4`}>
        <span className="text-sm font-semibold text-white/70">{label}</span>
        <span className="rounded-md border border-white/10 bg-white/10 p-2">{icon}</span>
      </div>
      <strong className="block text-4xl font-black tracking-normal text-white">{typeof value === "number" ? formatNumber(value) : value}</strong>
      <p className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-emerald-200" : isNegative ? "text-red-200" : "text-slate-300"}`}>
        {isPositive ? <ArrowUpRight size={16} /> : isNegative ? <ArrowDownRight size={16} /> : <Activity size={16} />}
        {formatDelta(delta, suffix)} vs previous period
      </p>
    </section>
  );
}

function BreakdownList({ title, items, empty = "No data yet." }: { title: string; items: CountItem[]; empty?: string }) {
  return (
    <section className="panel">
      <h2 className="mb-4 text-lg font-black text-white">{title}</h2>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-slate-100">{item.label}</span>
                <span className="shrink-0 text-slate-300">{formatNumber(item.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(4, item.share)}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-400">{item.share}%</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{empty}</p>
      )}
    </section>
  );
}

function Timeline({ points, max }: { points: Array<{ date: string; label: string; views: number; clicks: number; subscribers: number }>; max: number }) {
  return (
    <section className="panel">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Activity Over Time</h2>
          <p className="text-sm text-slate-400">Daily views, clicks, and subscribers for the selected range.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300" />Views</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-300" />Clicks</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" />Subscribers</span>
        </div>
      </div>
      <div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">
        {points.map((point) => {
          const viewsHeight = Math.max(3, (point.views / max) * 100);
          const clicksHeight = Math.max(3, (point.clicks / max) * 100);
          const subscribersHeight = Math.max(3, (point.subscribers / max) * 100);
          return (
            <div key={point.date} className="grid min-w-10 flex-1 content-end gap-2">
              <div className="flex h-44 items-end justify-center gap-1 rounded-md border border-white/5 bg-white/[.03] px-1 py-2" title={`${point.label}: ${point.views} views, ${point.clicks} clicks, ${point.subscribers} subscribers`}>
                <span className="w-2 rounded-full bg-cyan-300" style={{ height: `${viewsHeight}%` }} />
                <span className="w-2 rounded-full bg-violet-300" style={{ height: `${clicksHeight}%` }} />
                <span className="w-2 rounded-full bg-emerald-300" style={{ height: `${subscribersHeight}%` }} />
              </div>
              <span className="truncate text-center text-xs font-semibold text-slate-400">{point.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const days = safeDays(params.days);
  const [summary, events, botCount] = await Promise.all([
    analyticsSummary(days),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { block: true } }),
    prisma.event.count({ where: { isBot: true, createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } })
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">First-party performance data for your public page and links.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/api/export?type=analytics&format=csv"><Download size={16} />CSV</Link>
          <Link className="btn-secondary" href="/api/export?type=analytics&format=json"><Download size={16} />JSON</Link>
        </div>
      </div>

      <form className="panel flex flex-wrap items-end gap-3">
        <label className="field max-w-xs flex-1">
          Date range
          <select className="input" name="days" defaultValue={days}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </label>
        <button className="btn-secondary">Apply range</button>
        <span className="text-sm font-semibold text-slate-400">Bot-filtered summary, {formatNumber(botCount)} bot events excluded.</span>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Profile views" value={summary.views} delta={summary.deltas.views} icon={<Eye size={20} />} />
        <MetricCard label="Link clicks" value={summary.clicks} delta={summary.deltas.clicks} icon={<MousePointerClick size={20} />} tone="violet" />
        <MetricCard label="Click-through rate" value={`${summary.ctr}%`} delta={summary.deltas.ctr} suffix=" pts" icon={<BarChart3 size={20} />} tone="amber" />
        <MetricCard label="Subscribers" value={summary.subscribers} delta={summary.deltas.subscribers} icon={<Users size={20} />} tone="emerald" />
      </div>

      <Timeline points={summary.timeline} max={summary.maxDaily} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <BreakdownList title="Top Links" items={summary.topLinks} empty="No link clicks in this range yet." />
        <BreakdownList title="Top Referrers" items={summary.topReferrers} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BreakdownList title="Devices" items={summary.devices} />
        <BreakdownList title="Browsers" items={summary.browsers} />
        <BreakdownList title="Operating Systems" items={summary.operatingSystems} />
      </div>

      <section className="panel overflow-hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Recent Events</h2>
            <p className="text-sm text-slate-400">Latest 100 raw events, including bots for inspection.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300"><Bot size={16} />Bot visibility</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Target</th>
                <th className="py-3 pr-4">Referrer</th>
                <th className="py-3 pr-4">Device</th>
                <th className="py-3 pr-4">Bot</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-white/10">
                  <td className="py-3 pr-4 text-slate-300">{event.createdAt.toLocaleString()}</td>
                  <td className="py-3 pr-4 font-semibold text-white">{event.type.replaceAll("_", " ")}</td>
                  <td className="max-w-xs truncate py-3 pr-4 text-slate-300">{event.block?.title || event.shortCode || event.path || event.targetUrl || "Profile"}</td>
                  <td className="max-w-xs truncate py-3 pr-4 text-slate-400">{event.referrer || "Direct / unknown"}</td>
                  <td className="py-3 pr-4 text-slate-300">{event.device || "Unknown"}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-md px-2 py-1 text-xs font-bold ${event.isBot ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{event.isBot ? "Yes" : "No"}</span>
                  </td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td className="py-6 text-center text-slate-400" colSpan={6}>No events recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
