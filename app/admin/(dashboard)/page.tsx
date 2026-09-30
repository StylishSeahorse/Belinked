import { Suspense } from "react";
import { LinksEditor } from "@/components/editor/LinksEditor";
import { FlashMessage } from "@/components/FlashMessage";
import { analyticsSummary } from "@/lib/analytics";
import { requireOwner } from "@/lib/auth";
import { serializeBlock, serializeSocial } from "@/lib/editor-types";
import { readLinkHealth } from "@/lib/link-health";
import { readPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { parseSocialPlacement } from "@/lib/socials";
import { parseTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links" };

export default async function LinksPage() {
  await requireOwner();
  const [profile, blocks, socials, platform, health, summary] = await Promise.all([
    prisma.profile.findFirstOrThrow({ include: { theme: true } }),
    prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    readPlatformSettings(),
    readLinkHealth(),
    analyticsSummary(30)
  ]);
  const clicks = Object.fromEntries(summary.linkPerformance.map((link) => [link.key, link.clicks]));

  return (
    <>
      <div className="mx-auto max-w-[1600px] xl:grid xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="mx-auto w-full max-w-[728px] px-4 sm:px-6 [&:has(*)]:pt-4">
          <Suspense fallback={null}>
            <FlashMessage />
          </Suspense>
        </div>
      </div>
      <LinksEditor
        initialBlocks={blocks.map(serializeBlock)}
        initialSocials={socials.map(serializeSocial)}
        initialPlacement={parseSocialPlacement(platform.socialPlacement)}
        initialProfile={{
          id: profile.id,
          displayName: profile.displayName,
          username: profile.username,
          bio: profile.bio,
          badge: profile.badge,
          avatarUrl: profile.avatarUrl,
          logoUrl: profile.logoUrl,
          isPublished: profile.isPublished,
          cookieNoticeEnabled: profile.cookieNoticeEnabled,
          priorityRedirectOn: profile.priorityRedirectOn
        }}
        settings={parseTheme(profile.theme?.settings)}
        footerText={typeof platform.footerText === "string" ? platform.footerText : undefined}
        health={Object.fromEntries(Object.entries(health).map(([id, result]) => [id, { ok: result.ok, message: result.message }]))}
        clicks={clicks}
        onboarding={{ dismissed: platform.onboardingDismissed === true, themeChosen: Boolean(profile.theme && !profile.theme.isDefault) }}
      />
    </>
  );
}
