import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { safeUploadSegments, UPLOADS_ROOT } from "@/lib/upload-paths";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".ogv": "video/ogg",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: requestedPath } = await params;
  const segments = requestedPath || [];
  const safeSegments = safeUploadSegments(segments);
  if (safeSegments.length !== segments.length) return new NextResponse("Not found", { status: 404 });

  const filePath = path.join(UPLOADS_ROOT, ...safeSegments);
  const relative = path.relative(UPLOADS_ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentTypes[extension] || "application/octet-stream"
      }
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
