import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { UPLOADS_ROOT } from "./upload-paths";

const UPLOAD_PATH = /\/uploads\/[a-z0-9_-]+\/[a-z0-9._-]+/gi;

/** Every /uploads/... path referenced anywhere in the database. */
export async function referencedUploads() {
  const [profiles, blocks, themes, settings] = await Promise.all([
    prisma.profile.findMany({ select: { avatarUrl: true, logoUrl: true, ogImageUrl: true } }),
    prisma.block.findMany({ select: { imageUrl: true, metadata: true } }),
    prisma.theme.findMany({ select: { settings: true } }),
    prisma.appSetting.findMany({ select: { value: true } })
  ]);
  const haystack = JSON.stringify([profiles, blocks, themes, settings]);
  return new Set((haystack.match(UPLOAD_PATH) || []).map((value) => value.toLowerCase()));
}

/**
 * Deletes uploaded files no longer referenced by any record. Files younger than an
 * hour are kept so an upload in progress in another tab is never removed.
 */
export async function cleanupUnusedUploads({ minAgeMs = 60 * 60 * 1000 } = {}) {
  const referenced = await referencedUploads();
  let deleted = 0;
  let bytes = 0;
  let folders: string[] = [];
  try {
    folders = await readdir(UPLOADS_ROOT);
  } catch {
    return { deleted, bytes };
  }
  for (const folder of folders) {
    const folderPath = path.join(UPLOADS_ROOT, folder);
    const folderStat = await stat(folderPath).catch(() => null);
    if (!folderStat?.isDirectory()) continue;
    for (const file of await readdir(folderPath)) {
      if (file.startsWith(".")) continue;
      const filePath = path.join(folderPath, file);
      const fileStat = await stat(filePath).catch(() => null);
      if (!fileStat?.isFile() || Date.now() - fileStat.mtimeMs < minAgeMs) continue;
      if (referenced.has(`/uploads/${folder}/${file}`.toLowerCase())) continue;
      await unlink(filePath);
      deleted += 1;
      bytes += fileStat.size;
    }
  }
  return { deleted, bytes };
}
