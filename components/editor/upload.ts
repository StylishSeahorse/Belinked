"use client";

import { uploadFile } from "@/app/editor-actions";
import type { ActionResult } from "@/lib/editor-types";

/** Must stay below `serverActions.bodySizeLimit` in next.config.ts. */
const MAX_REQUEST_MB = 60;

/**
 * Uploads one file through the server action and always resolves to a result, so the
 * editor can show a message. A rejected request (e.g. dropped connection) would
 * otherwise surface as an unhandled error with no feedback.
 */
export async function uploadMedia(file: File, folder: "profile" | "blocks" | "themes", kind: "image" | "media" = "image"): Promise<ActionResult<string>> {
  if (file.size > MAX_REQUEST_MB * 1024 * 1024) return { ok: false, error: `That file is too large. Keep uploads under ${MAX_REQUEST_MB}MB.` };
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  if (kind === "media") form.set("kind", "media");
  try {
    return await uploadFile(form);
  } catch {
    return { ok: false, error: "Upload failed. Check your connection and try a smaller file." };
  }
}
