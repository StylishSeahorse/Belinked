import { AppearanceEditor } from "@/components/editor/AppearanceEditor";
import { requireOwner } from "@/lib/auth";
import { CUSTOM_THEME_NAME, serializeBlock, serializeSocial } from "@/lib/editor-types";
import { readPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { parseSocialPlacement } from "@/lib/socials";
import { defaultThemes, parseTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appearance" };

export default async function AppearancePage() {
  await requireOwner();
  // Make sure the preset gallery is never empty (e.g. older installs).
  if ((await prisma.theme.count()) < defaultThemes.length) {
    for (const theme of defaultThemes) {
      await prisma.theme.upsert({ where: { name: theme.name }, update: {}, create: { name: theme.name, settings: JSON.stringify(theme.settings), isDefault: theme.isDefault } });
    }
  }
  const [themes, profile, blocks, socials, platform] = await Promise.all([
    prisma.theme.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.profile.findFirstOrThrow(),
    prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.socialIcon.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    readPlatformSettings()
  ]);
  const ordered = [...themes.filter((theme) => theme.name === CUSTOM_THEME_NAME), ...themes.filter((theme) => theme.name !== CUSTOM_THEME_NAME)];

  return (
    <AppearanceEditor
      themes={ordered.map((theme) => ({ id: theme.id, name: theme.name, settings: parseTheme(theme.settings) }))}
      activeId={profile.themeId}
      preview={{
        profile: {
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
        },
        blocks: blocks.map(serializeBlock),
        socials: socials.map(serializeSocial),
        placement: parseSocialPlacement(platform.socialPlacement),
        footerText: typeof platform.footerText === "string" ? platform.footerText : undefined
      }}
    />
  );
}
