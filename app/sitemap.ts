import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [base, profile] = await Promise.all([siteUrl(), prisma.profile.findFirst({ select: { isPublished: true, allowIndexing: true, updatedAt: true } })]);
  if (!profile?.isPublished || !profile.allowIndexing) return [];
  return [{ url: `${base}/`, lastModified: profile.updatedAt, changeFrequency: "weekly", priority: 1 }];
}
