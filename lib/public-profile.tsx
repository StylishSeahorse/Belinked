import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicProfile } from "@/components/PublicProfile";
import { currentOwner } from "@/lib/auth";
import { fetchMetaIntegrationData } from "@/lib/meta-integration";
import { readPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { publicBlocks, publicSocials, toPublicProfile } from "@/lib/public-data";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { parseSocialPlacement } from "@/lib/socials";
import { parseTheme } from "@/lib/themes";
import { safeHref } from "@/lib/validation";

export async function publicProfileMetadata(): Promise<Metadata> {
  const profile = await prisma.profile.findFirst();
  if (!profile) return { robots: { index: false, follow: false } };
  const base = await siteUrl();
  const title = profile.seoTitle || profile.displayName;
  const description = profile.seoDescription || profile.bio || undefined;
  const image = absoluteUrl(base, profile.ogImageUrl || profile.avatarUrl);
  const indexable = profile.isPublished && profile.allowIndexing && !profile.priorityRedirectOn;
  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: { canonical: "/" },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    icons: profile.logoUrl || profile.avatarUrl ? { icon: profile.logoUrl || profile.avatarUrl || undefined, apple: profile.logoUrl || profile.avatarUrl || undefined } : undefined,
    openGraph: {
      type: "profile",
      url: "/",
      title,
      description,
      images: image ? [image] : undefined
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined
    }
  };
}

function structuredData(base: string, profile: { displayName: string; bio: string; avatarUrl: string | null }, sameAs: string[]) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: base,
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      description: profile.bio || undefined,
      image: absoluteUrl(base, profile.avatarUrl),
      sameAs: sameAs.length ? sameAs : undefined
    }
  };
  // Escape "<" so profile text can never close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function renderPublicProfile({ subscribed = false, subscribeError }: { subscribed?: boolean; subscribeError?: string } = {}) {
  const profile = await prisma.profile.findFirst({ include: { theme: true } });
  if (!profile) redirect("/admin/setup");
  const owner = await currentOwner();

  if (!profile.isPublished && !owner) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <h1 className="text-2xl font-black">This page is not published yet.</h1>
      </main>
    );
  }
  // The owner always sees the real page so they can still manage it while a redirect is on.
  if (!owner && profile.priorityRedirectOn) {
    const target = safeHref(profile.priorityRedirectUrl);
    if (target) redirect(target);
  }

  const [blocks, socials, platform, base] = await Promise.all([
    prisma.block.findMany({ where: { status: "ACTIVE" }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.socialIcon.findMany({ where: { isVisible: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    readPlatformSettings(),
    siteUrl()
  ]);
  const metaIntegration = await fetchMetaIntegrationData(platform);
  const safeSocials = publicSocials(socials);
  const publicProfile = toPublicProfile(profile);

  let previewNotice: string | undefined;
  if (owner && !profile.isPublished) previewNotice = "Preview: this page is unpublished and only visible to you.";
  else if (owner && profile.priorityRedirectOn) previewNotice = "Preview: visitors are currently redirected elsewhere.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData(base, publicProfile, safeSocials.filter((social) => social.url.startsWith("http")).map((social) => social.url)) }}
      />
      <PublicProfile
        profile={publicProfile}
        blocks={publicBlocks(blocks)}
        socials={safeSocials}
        socialPlacement={parseSocialPlacement(platform.socialPlacement)}
        settings={parseTheme(profile.theme?.settings)}
        metaIntegration={metaIntegration}
        track={!owner}
        subscribed={subscribed}
        subscribeError={subscribeError}
        previewNotice={previewNotice}
        footerText={typeof platform.footerText === "string" ? platform.footerText.slice(0, 200) : undefined}
      />
    </>
  );
}
