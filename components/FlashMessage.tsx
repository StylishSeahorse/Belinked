"use client";

import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Renders ?notice= / ?error= flash messages set by server actions. */
export function FlashMessage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = params.get("notice");
  const error = params.get("error");
  if (!notice && !error) return null;

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete("notice");
    next.delete("error");
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-5 flex items-start gap-3 rounded-lg border p-3 text-sm font-semibold ${
        error ? "border-red-400/40 bg-red-500/15 text-red-100" : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
      }`}
    >
      {error ? <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <p className="flex-1">{error || notice}</p>
      <button type="button" onClick={dismiss} className="rounded p-0.5 hover:bg-white/10" aria-label="Dismiss message">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
