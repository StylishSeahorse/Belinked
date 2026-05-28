"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { adminNavItems } from "@/lib/admin-nav";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 flex-col gap-6 border-r border-white/10 bg-[#0e1726]/88 p-6 backdrop-blur md:flex">
      <div className="grid gap-1">
        <Link href="/admin" className="text-xl font-black tracking-tight text-white">
          Belinked
        </Link>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/55">Control Panel</p>
      </div>
      <nav className="grid gap-1.5">
        {adminNavItems.map(([label, href]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                "rounded-xl px-4 py-3 text-sm font-semibold transition",
                active ? "bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.18)]" : "text-slate-300 hover:bg-white/6 hover:text-white"
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
        Local-first admin for your public profile, themes, analytics, and redirects.
      </div>
      <form action={logoutAction} className="mt-auto">
        <button className="btn-secondary w-full">Sign out</button>
      </form>
    </aside>
  );
}
