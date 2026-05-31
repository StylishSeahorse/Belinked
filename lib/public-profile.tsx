import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicProfile } from "@/components/PublicProfile";
import { fetchMetaIntegrationData } from "@/lib/meta-integration";
import { prisma } from "@/lib/prisma";
import { parseSocialPlacement } from "@/lib/socials";
import { assertSafeRedirect } from "@/lib/validation";

export async function publicProfileMetadata(): Promise<Metadata> {
  const profile = await prisma.profile.findFirst();
  if (!profile) return {};
  return {
    title: profile.seoTitle || profile.displayName,
    description: profile.seoDescription || profile.bio,
    icons: profile.logoUrl
      ? {
          icon: profile.logoUrl,
          apple: profile.logoUrl
        }
      : undefined,
    openGraph: {
      title: profile.seoTitle || profile.displayName,
      description: profile.seoDescription || profile.bio,
      images: profile.ogImageUrl ? [profile.ogImageUrl] : undefined
    }
  };
}

export async function renderPublicProfile() {
  const profile = await prisma.profile.findFirst({ include: { theme: true } });
  if (!profile) redirect("/admin/setup");
  if (!profile.isPublished) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <h1 className="text-2xl font-black">Profile unavailable</h1>
      </main>
    );
  }
  if (profile.priorityRedirectOn && profile.priorityRedirectUrl) redirect(assertSafeRedirect(profile.priorityRedirectUrl));
  const [blocks, socials, setting] = await Promise.all([
    prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.socialIcon.findMany({ where: { isVisible: true }, orderBy: { position: "asc" } }),
    prisma.appSetting.findUnique({ where: { key: "platform" } })
  ]);
  let platform: Record<string, unknown> = {};
  try {
    platform = JSON.parse(setting?.value || "{}");
  } catch {
    platform = {};
  }
  const metaIntegration = await fetchMetaIntegrationData(platform);
  return (
    <PublicProfile
      profile={profile}
      blocks={blocks}
      socials={socials}
      socialPlacement={parseSocialPlacement(platform.socialPlacement)}
      theme={profile.theme}
      metaIntegration={metaIntegration}
    />
  );
}
