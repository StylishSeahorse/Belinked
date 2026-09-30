import { AppShell } from "@/components/editor/AppShell";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  const [profile, base] = await Promise.all([prisma.profile.findFirst({ select: { isPublished: true } }), siteUrl()]);
  return (
    <AppShell initialPublished={profile?.isPublished ?? false} siteUrl={`${base}/`} displayName={owner.displayName}>
      {children}
    </AppShell>
  );
}
