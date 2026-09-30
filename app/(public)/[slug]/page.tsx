import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The profile lives at "/"; its configured slug is kept as a friendly alias. */
export default async function PublicAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await prisma.profile.findFirst({ select: { slug: true } });
  if (profile && profile.slug.toLowerCase() === slug.toLowerCase()) redirect("/");
  notFound();
}
