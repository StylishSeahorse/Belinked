import { AdminNav } from "@/components/AdminNav";
import { AdminMobileNav } from "@/components/AdminMobileNav";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="admin-shell min-h-screen">
      <AdminMobileNav />
      <div className="md:flex">
        <AdminNav />
        <main className="admin-main flex-1 p-5 md:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
