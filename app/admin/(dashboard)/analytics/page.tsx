import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TrendChart } from "@/components/editor/TrendChart";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const RANGES: Array<[number, string]> = [
  [1, "Today"],
  [7, "7 days"],
  [30, "30 days"],
  [90, "90 days"],
  [365, "12 months"]
];

function safeDays(value?: string) {
  const days = Number(value || 30);
  return RANGES.some(([range]) => range === days) ? days : 30;
}

const number = (value: number) => new Intl.NumberFormat("en-US").format(value);

function Stat({ label, value, delta, suffix = "" }: { label: string; value: string; delta?: number; suffix?: string }) {
  return (
    <div className="panel grid gap-1 p-4 sm:p-5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <strong className="text-3xl font-black tabular-nums tracking-tight">{value}</strong>
      {delta !== undefined ? (
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${delta > 0 ? "text-[var(--ui-success)]" : delta < 0 ? "text-[var(--ui-danger)]" : "text-muted"}`}>
          {delta > 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : delta < 0 ? <ArrowDownRight size={13} aria-hidden="true" /> : null}
          {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${number(delta)}${suffix}`}
          <span className="font-semibold text-muted">vs previous</span>
        </span>
      ) : null}
    </div>
  );
}

/** Ranked horizontal bars: one hue, thin, value labelled in text colour. */
function RankedBars({ title, items, empty, valueLabel = "" }: { title: string; items: Array<{ label: string; count: number; share: number }>; empty: string; valueLabel?: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel grid content-start gap-4">
      <h2 className="font-black">{title}</h2>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{item.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  <strong className="text-[var(--ui-ink)]">{number(item.count)}</strong> {valueLabel} · {item.share}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#f0f0ec]">
                <div className="h-2 rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <h3 className="text-sm font-black">{title}</h3>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireOwner();
  const days = safeDays((await searchParams).days);
  const since = new Date(Date.now() - days * 86_400_000);
  const [summary, events, botCount] = await Promise.all([
    analyticsSummary(days),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { block: { select: { title: true } } } }),
    prisma.event.count({ where: { isBot: true, createdAt: { gte: since } } })
  ]);
  const rangeLabel = RANGES.find(([range]) => range === days)?.[1] || "";
  const hasData = summary.views + summary.clicks + summary.previous.views > 0;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Analytics</h1>
          <p className="text-sm text-muted">How visitors find and use your page. Private and cookie-free; bots are excluded.</p>
        </div>
        <nav className="segmented overflow-x-auto" aria-label="Date range">
          {RANGES.map(([range, label]) => (
            <Link key={range} href={`/admin/analytics?days=${range}`} aria-current={range === days ? "page" : undefined} className="whitespace-nowrap">
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Views" value={number(summary.views)} delta={summary.deltas.views} />
        <Stat label="Visitors" value={number(summary.visitors)} delta={summary.deltas.visitors} />
        <Stat label="Clicks" value={number(summary.clicks)} delta={summary.deltas.clicks} />
        <Stat label="Click rate" value={`${summary.ctr}%`} delta={summary.deltas.ctr} suffix=" pts" />
      </div>

      {!hasData ? (
        <section className="panel grid justify-items-center gap-2 py-10 text-center">
          <h2 className="text-lg font-black">No visits yet</h2>
          <p className="max-w-md text-sm text-muted">Share your page and numbers will appear here as people visit and tap your links. Your own visits while signed in are never counted.</p>
        </section>
      ) : null}

      {days > 1 ? (
        <section className="panel grid gap-2">
          <h2 className="font-black">Views and clicks · {rangeLabel}</h2>
          <TrendChart points={summary.timeline.map((point) => ({ date: point.date, label: point.label, views: point.views, clicks: point.clicks }))} />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel grid content-start gap-4">
          <h2 className="font-black">Top links</h2>
          {summary.linkPerformance.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="pb-2">Link</th>
                  <th scope="col" className="pb-2 text-right">Clicks</th>
                  <th scope="col" className="pb-2 text-right">Click rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.linkPerformance.slice(0, 8).map((link) => (
                  <tr key={link.key} className="border-t border-[var(--ui-border)]">
                    <td className="max-w-[14rem] truncate py-2.5 pr-3 font-semibold">{link.label}</td>
                    <td className="py-2.5 text-right tabular-nums">{number(link.clicks)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted">{link.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">No link clicks in this period yet.</p>
          )}
        </section>
        <RankedBars title="Traffic sources" items={summary.topReferrers} empty="No visits in this period yet." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankedBars title="Devices" items={summary.devices} empty="No visits in this period yet." />
        <RankedBars title="Countries" items={summary.countries} empty="Country data appears when your page is served through a CDN such as Cloudflare. No IP lookups are done." />
      </div>

      <details className="panel group">
        <summary className="cursor-pointer list-none font-black">
          More details <span className="text-sm font-semibold text-muted">· browsers, campaigns, raw events, export</span>
        </summary>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <Details title="Browsers">
            <ul className="grid gap-1 text-sm">{summary.browsers.map((item) => <li key={item.label} className="flex justify-between"><span>{item.label}</span><span className="tabular-nums text-muted">{number(item.count)}</span></li>)}</ul>
          </Details>
          <Details title="Operating systems">
            <ul className="grid gap-1 text-sm">{summary.operatingSystems.map((item) => <li key={item.label} className="flex justify-between"><span>{item.label}</span><span className="tabular-nums text-muted">{number(item.count)}</span></li>)}</ul>
          </Details>
          <Details title="Campaigns (UTM)">
            {summary.campaigns.length ? (
              <ul className="grid gap-1 text-sm">{summary.campaigns.map((item) => <li key={item.label} className="flex justify-between gap-3"><span className="truncate">{item.label}</span><span className="tabular-nums text-muted">{number(item.count)}</span></li>)}</ul>
            ) : (
              <p className="text-sm text-muted">Add ?utm_campaign=… to the link you share to track campaigns.</p>
            )}
          </Details>
          <Details title="Export">
            <p className="text-sm text-muted">{number(botCount)} bot visits were filtered out in this period.</p>
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary btn-sm" download href={`/api/export?type=analytics&format=csv&days=${days}`}>
                <Download size={14} aria-hidden="true" /> CSV
              </a>
              <a className="btn-secondary btn-sm" download href={`/api/export?type=analytics&format=json&days=${days}`}>
                <Download size={14} aria-hidden="true" /> JSON
              </a>
            </div>
          </Details>
        </div>
        <div className="mt-6 overflow-x-auto">
          <h3 className="mb-2 text-sm font-black">Latest activity</h3>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="py-2">When (UTC)</th>
                <th scope="col" className="py-2">What</th>
                <th scope="col" className="py-2">Source</th>
                <th scope="col" className="py-2">Device</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className={`border-t border-[var(--ui-border)] ${event.isBot ? "text-muted" : ""}`}>
                  <td className="py-2 tabular-nums">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                  <td className="max-w-[16rem] truncate py-2">
                    {event.type === "PROFILE_VIEW" ? "Page view" : event.type === "SUBSCRIBER" ? "New subscriber" : `Click: ${event.block?.title || event.shortCode || "link"}`}
                    {event.isBot ? " (bot)" : ""}
                  </td>
                  <td className="max-w-[12rem] truncate py-2 text-muted">{event.referrer?.replace(/^https?:\/\/(www\.)?/, "") || "Direct"}</td>
                  <td className="py-2 capitalize text-muted">{event.device || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
