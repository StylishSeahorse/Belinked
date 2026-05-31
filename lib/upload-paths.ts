import path from "node:path";

export const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export function safeUploadFolder(folder: string) {
  return folder.replace(/[^a-z0-9-_]/gi, "").toLowerCase() || "profile";
}

export function safeUploadSegments(segments: string[]) {
  return segments.map((segment) => segment.replace(/[^a-z0-9._-]/gi, "")).filter(Boolean);
}
