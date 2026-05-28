import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "admin" || slug === "s" || slug === "api") redirect(`/${slug}`);
  const profile = await prisma.profile.findFirst();
  if (profile?.slug === slug) redirect("/");
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
      <h1 className="text-2xl font-black">Page not found</h1>
    </main>
  );
}
