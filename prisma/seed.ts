import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ownerSeedFromEnv } from "../lib/setup";
import { defaultThemes } from "../lib/themes";

async function main() {
  for (const theme of defaultThemes) {
    await prisma.theme.upsert({
      where: { name: theme.name },
      update: { settings: JSON.stringify(theme.settings), isDefault: theme.isDefault },
      create: {
        name: theme.name,
        settings: JSON.stringify(theme.settings),
        isDefault: theme.isDefault
      }
    });
  }

  const ownerCount = await prisma.owner.count();
  const ownerSeed = ownerSeedFromEnv();
  if (ownerCount === 0 && ownerSeed) {
    const passwordHash = await bcrypt.hash(ownerSeed.password, 12);
    const owner = await prisma.owner.create({
      data: {
        email: ownerSeed.email,
        passwordHash,
        displayName: ownerSeed.displayName
      }
    });
    await prisma.auditLog.create({
      data: { ownerId: owner.id, action: "owner.created.from_env" }
    });
  }

  const profileCount = await prisma.profile.count();
  if (profileCount === 0) {
    const theme = await prisma.theme.findFirst({ where: { isDefault: true } });
    await prisma.profile.create({
      data: {
        slug: "profile",
        displayName: process.env.SETUP_DISPLAY_NAME || "Belinked Owner",
        username: "local-profile",
        bio: "A self-hosted link hub for everything worth sharing.",
        themeId: theme?.id
      }
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "platform" },
    update: {},
    create: {
      key: "platform",
      value: JSON.stringify({
        name: "Belinked",
        footerText: "Powered by a local-first link hub",
        supportUrl: "",
        storageMode: process.env.STORAGE_MODE || "local",
        emailProvider: process.env.SMTP_HOST ? "smtp" : "disabled",
        meta: {
          enabled: process.env.META_INTEGRATION_ENABLED === "true",
          graphVersion: process.env.META_GRAPH_VERSION || "v23.0",
          instagramUserId: process.env.META_INSTAGRAM_USER_ID || "",
          instagramAccessToken: process.env.META_INSTAGRAM_ACCESS_TOKEN || "",
          facebookPageId: process.env.META_FACEBOOK_PAGE_ID || "",
          facebookAccessToken: process.env.META_FACEBOOK_ACCESS_TOKEN || ""
        }
      })
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
