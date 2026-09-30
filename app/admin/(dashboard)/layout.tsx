import { Suspense } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AdminMobileNav } from "@/components/AdminMobileNav";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="admin-shell min-h-screen">
      <a href="#admin-content" className="skip-link">Skip to content</a>
      <AdminMobileNav />
      <div className="md:flex">
        <AdminNav />
        <main id="admin-content" className="admin-main min-w-0 flex-1 p-4 sm:p-5 md:p-8">
          <div className="mx-auto w-full max-w-7xl">
            <Suspense fallback={null}>
              <FlashMessage />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
