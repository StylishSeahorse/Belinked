import { UserError } from "./errors";
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
    throw new UserError(`Upload must be a supported ${label}.`);
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new UserError(`Upload must be ${maxMb}MB or smaller.`);
  }
  return storeBytes(Buffer.from(await file.arrayBuffer()), file.type, folder, extension, label);
}

/** Validates bytes against their declared type (signature + image dimensions) and writes them under /uploads. */
async function storeBytes(bytes: Buffer, type: string, folder: string, extension: string, label: string) {
  if (!hasExpectedSignature(bytes, type)) {
    throw new UserError(`Upload content does not match the declared ${label}.`);
  }

  if (type_is_image(type)) {
    const size = imageDimensions(bytes, type);
    if (!size) throw new UserError("Could not read the image dimensions. Try re-exporting the image.");
    if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE || size.width * size.height > MAX_IMAGE_PIXELS) {
      throw new UserError(`Images must be at most ${MAX_IMAGE_SIDE}px on each side.`);
    }
  }

  const safeFolder = safeUploadFolder(folder);
  const uploadDir = path.join(UPLOADS_ROOT, safeFolder);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${nanoid(10)}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/${safeFolder}/${filename}`;
}

const MAX_IMAGE_SIDE = 8000;
const MAX_IMAGE_PIXELS = 40_000_000;

function type_is_image(type: string) {
  return allowedImageTypes.has(type);
}

/** Reads width/height from image headers without decoding pixels. */
export function imageDimensions(bytes: Buffer, type: string): { width: number; height: number } | null {
  try {
    if (type === "image/png") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (type === "image/gif") return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
    if (type === "image/webp") {
      const chunk = bytes.subarray(12, 16).toString("ascii");
      if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
      if (chunk === "VP8L") {
        const bits = bytes.readUInt32LE(21);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
      if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      return null;
    }
    if (type === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1];
        const length = bytes.readUInt16BE(offset + 2);
        // SOF0..SOF15 excluding DHT (C4), JPG (C8), DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
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

/**
 * Stores image bytes fetched from elsewhere (e.g. a link's preview image) with exactly
 * the same checks as an upload. Only JPG/PNG/WebP/GIF are accepted (never SVG).
 */
export async function saveImageBytes(bytes: Buffer, contentType: string, folder: string) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const extension = allowedImageTypes.get(type === "image/jpg" ? "image/jpeg" : type);
  if (!extension) throw new UserError("That image format isn't supported.");
  const maxMb = Number(process.env.UPLOAD_MAX_MB || 15);
  if (bytes.length > maxMb * 1024 * 1024) throw new UserError(`Images must be ${maxMb}MB or smaller.`);
  return storeBytes(bytes, type === "image/jpg" ? "image/jpeg" : type, folder, extension, "image");
}

export async function saveUploadedImage(file: FormDataEntryValue | null, folder: string) {
  return saveUploadedFile(file, folder, allowedImageTypes, Number(process.env.UPLOAD_MAX_MB || 15), "JPG, PNG, WebP, or GIF image");
}

export async function saveUploadedVideo(file: FormDataEntryValue | null, folder: string) {
  return saveUploadedFile(file, folder, allowedVideoTypes, Number(process.env.VIDEO_UPLOAD_MAX_MB || 50), "MP4, WebM, Ogg, or MOV video");
}

export async function saveUploadedMedia(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (allowedImageTypes.has(file.type)) return saveUploadedImage(file, folder);
  if (allowedVideoTypes.has(file.type)) return saveUploadedVideo(file, folder);
  throw new UserError("Upload must be a supported image or video file.");
}
