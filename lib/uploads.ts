import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { safeUploadFolder, UPLOADS_ROOT } from "./upload-paths";

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
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(bytes, file.type)) {
    throw new Error(`Upload content does not match the declared ${label}.`);
  }

  const safeFolder = safeUploadFolder(folder);
  const uploadDir = path.join(UPLOADS_ROOT, safeFolder);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${nanoid(10)}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/${safeFolder}/${filename}`;
}

function hasExpectedSignature(bytes: Buffer, type: string) {
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/gif") return bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a";
  if (type === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (type === "video/mp4" || type === "video/quicktime") return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (type === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (type === "video/ogg") return bytes.subarray(0, 4).toString("ascii") === "OggS";
  return false;
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
