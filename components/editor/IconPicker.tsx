"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { iconPack, iconPackGroups, PackIconGlyph } from "@/lib/icon-pack";

/** Searchable grid of built-in thumbnail icons. */
export function IconPicker({ value, onSelect }: { value: string | null; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? iconPack.filter((icon) => `${icon.label} ${icon.keywords} ${icon.group}`.toLowerCase().includes(q)) : iconPack;
  }, [query]);

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--ui-border)] bg-[#fafaf8] p-3">
      <label className="relative block">
        <span className="sr-only">Search icons</span>
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input className="input w-full rounded-full !pl-9" placeholder="Search icons: shop, music, tickets…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="grid max-h-72 gap-3 overflow-y-auto pr-1">
        {iconPackGroups.map((group) => {
          const icons = results.filter((icon) => icon.group === group);
          if (!icons.length) return null;
          return (
            <section key={group} aria-label={`${group} icons`}>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{group}</h4>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {icons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => onSelect(icon.id)}
                    aria-pressed={value === icon.id}
                    aria-label={icon.label}
                    title={icon.label}
                    className={`grid aspect-square place-items-center rounded-xl border bg-white transition hover:border-[var(--ui-accent)] ${value === icon.id ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]" : "border-[var(--ui-border)]"}`}
                  >
                    <PackIconGlyph id={icon.id} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {!results.length ? <p className="py-4 text-center text-sm text-muted">No icons match “{query}”.</p> : null}
      </div>
    </div>
  );
}
