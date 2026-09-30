import { prisma } from "./prisma";

export type PlatformSettings = Record<string, unknown>;

export async function readPlatformSettings(): Promise<PlatformSettings> {
  const existing = await prisma.appSetting.findUnique({ where: { key: "platform" } });
  try {
    const parsed = JSON.parse(existing?.value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function writePlatformSettings(value: PlatformSettings) {
  await prisma.appSetting.upsert({
    where: { key: "platform" },
    update: { value: JSON.stringify(value) },
    create: { key: "platform", value: JSON.stringify(value) }
  });
}

const SECRET_KEYS = new Set(["password", "instagramAccessToken", "facebookAccessToken"]);

/**
 * Returns a copy safe to send to the browser or include in exports: secret values are
 * replaced with a boolean "is set" marker.
 */
export function redactPlatformSettings(value: PlatformSettings): PlatformSettings {
  const walk = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(walk);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, entry]) =>
        SECRET_KEYS.has(key) ? [key, entry ? "__set__" : ""] : [key, walk(entry)]
      )
    );
  };
  return walk(value) as PlatformSettings;
}
