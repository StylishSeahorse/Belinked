import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [base, profile] = await Promise.all([siteUrl(), prisma.profile.findFirst({ select: { isPublished: true, allowIndexing: true } })]);
  const indexable = Boolean(profile?.isPublished && profile.allowIndexing);
  return {
    rules: indexable
      ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/s/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: indexable ? `${base}/sitemap.xml` : undefined
  };
}
