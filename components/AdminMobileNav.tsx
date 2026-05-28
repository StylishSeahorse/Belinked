"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminNavItems } from "@/lib/admin-nav";

export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const selected = adminNavItems.find(([, href]) => pathname === href)?.[1] || "/admin";

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0e1726]/94 px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link href="/admin" className="text-lg font-black tracking-tight text-white">
          Belinked
        </Link>
        <label className="relative ml-auto flex min-w-0 flex-1 items-center">
          <Menu className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <select
            aria-label="Admin section"
            className="input h-11 appearance-none pl-9 font-semibold"
            value={selected}
            onChange={(event) => router.push(event.target.value)}
          >
            {adminNavItems.map(([label, href]) => (
              <option key={href} value={href}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
