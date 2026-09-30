"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { date: string; label: string; views: number; clicks: number };

// Validated reference palette (categorical slots 1 & 2); text never uses series colours.
const SERIES = [
  { key: "views", label: "Views", color: "#2a78d6" },
  { key: "clicks", label: "Clicks", color: "#eb6834" }
] as const;

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude * 4 >= value) || 10;
  return step * magnitude * 4;
}

/** Views & clicks over time: 2px lines, one axis, crosshair tooltip, legend + end labels. */
export function TrendChart({ points }: { points: Point[] }) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = 240;
  const pad = { top: 12, right: 64, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...points.flatMap((point) => [point.views, point.clicks])));
  const x = (index: number) => pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => pad.top + innerH - (value / max) * innerH;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70))));

  const paths = useMemo(
    () => SERIES.map((series) => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[series.key]).toFixed(1)}`).join(" ")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, max]
  );

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left;
    const index = Math.round((relative / rect.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, index)));
  }

  const last = points.length - 1;
  const hovered = hover !== null ? points[hover] : null;
  const total = { views: points.reduce((sum, point) => sum + point.views, 0), clicks: points.reduce((sum, point) => sum + point.clicks, 0) };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-bold text-muted" aria-label="Legend">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: series.color }} aria-hidden="true" />
              {series.label}
            </span>
          ))}
        </div>
        <button className="btn-ghost btn-sm text-muted" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable}>
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto rounded-2xl border border-[var(--ui-border)]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f7f7f5] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Date</th>
                <th scope="col" className="px-3 py-2 text-right">Views</th>
                <th scope="col" className="px-3 py-2 text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-[var(--ui-border)]">
                  <td className="px-3 py-1.5">{point.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{point.views}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{point.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={holder} className="relative min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={`Views and clicks per day: ${total.views} views and ${total.clicks} clicks in this period.`} className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#ececec" strokeWidth={1} />
                <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[#8a8a94] text-[11px] tabular-nums">
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </text>
              </g>
            ))}
            {points.map((point, index) =>
              (index % labelEvery === 0 && last - index >= labelEvery * 0.7) || index === last ? (
                <text key={point.date} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"} className="fill-[#8a8a94] text-[11px]">
                  {point.label}
                </text>
              ) : null
            )}
            {hovered !== null && hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="#c9c9c2" strokeWidth={1} /> : null}
            {SERIES.map((series, seriesIndex) => (
              <path key={series.key} d={paths[seriesIndex]} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {SERIES.map((series) => {
              const index = hover ?? last;
              const value = points[index]?.[series.key] ?? 0;
              return <circle key={series.key} cx={x(index)} cy={y(value)} r={4} fill={series.color} stroke="#ffffff" strokeWidth={2} />;
            })}
            {/* Direct end labels (nudged apart if they would collide) */}
            {(() => {
              const yViews = y(points[last]?.views ?? 0);
              let yClicks = y(points[last]?.clicks ?? 0);
              if (Math.abs(yViews - yClicks) < 14) yClicks = yViews + (yClicks >= yViews ? 14 : -14);
              return (
                <>
                  <text x={x(last) + 10} y={yViews} dy="0.32em" className="fill-[#16161d] text-[11px] font-bold">Views</text>
                  <text x={x(last) + 10} y={yClicks} dy="0.32em" className="fill-[#16161d] text-[11px] font-bold">Clicks</text>
                </>
              );
            })()}
            <rect x={pad.left} y={pad.top} width={Math.max(1, innerW)} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
          {hovered && hover !== null ? (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-32 rounded-xl border border-[var(--ui-border)] bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: Math.min(Math.max(0, x(hover) - 64), width - 140) }}
              role="status"
            >
              <p className="mb-1 font-bold">{hovered.label}</p>
              {SERIES.map((series) => (
                <p key={series.key} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: series.color }} aria-hidden="true" />
                    {series.label}
                  </span>
                  <span className="font-bold tabular-nums">{hovered[series.key]}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
