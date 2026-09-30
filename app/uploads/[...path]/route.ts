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

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: requestedPath } = await params;
  const segments = requestedPath || [];
  const safeSegments = safeUploadSegments(segments);
  if (safeSegments.length !== segments.length) return new NextResponse("Not found", { status: 404 });

  const filePath = path.join(UPLOADS_ROOT, ...safeSegments);
  const relative = path.relative(UPLOADS_ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return new NextResponse("Not found", { status: 404 });

  try {
    const extension = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[extension];
    // Only serve media types Belinked itself writes.
    if (!contentType) return new NextResponse("Not found", { status: 404 });
    const bytes = await readFile(filePath);
    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff"
    };
    // Byte ranges are required for video playback on Safari/iOS.
    const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const size = bytes.length;
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) }
      });
    }
    return new NextResponse(new Uint8Array(bytes), { headers: { ...baseHeaders, "Content-Length": String(bytes.length) } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
