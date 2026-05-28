import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

const allowedVideoTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/ogg", "ogv"],
  ["video/quicktime", "mov"]
]);

async function saveUploadedFile(file: FormDataEntryValue | null, folder: string, allowedTypes: Map<string, string>, maxMb: number, label: string) {
  if (!(file instanceof File) || file.size === 0) return undefined;
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    throw new Error(`Upload must be a supported ${label}.`);
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Upload must be ${maxMb}MB or smaller.`);
  }

  const safeFolder = folder.replace(/[^a-z0-9-_]/gi, "").toLowerCase() || "profile";
  const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${nanoid(10)}.${extension}`;
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${safeFolder}/${filename}`;
}

export async function saveUploadedImage(file: FormDataEntryValue | null, folder: string) {
  return saveUploadedFile(file, folder, allowedImageTypes, Number(process.env.UPLOAD_MAX_MB || 5), "JPG, PNG, WebP, or GIF image");
}

export async function saveUploadedVideo(file: FormDataEntryValue | null, folder: string) {
  return saveUploadedFile(file, folder, allowedVideoTypes, Number(process.env.VIDEO_UPLOAD_MAX_MB || 50), "MP4, WebM, Ogg, or MOV video");
}

export async function saveUploadedMedia(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (allowedImageTypes.has(file.type)) return saveUploadedImage(file, folder);
  if (allowedVideoTypes.has(file.type)) return saveUploadedVideo(file, folder);
  throw new Error("Upload must be a supported image or video file.");
}
