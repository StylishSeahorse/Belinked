import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { fetchLinkPreview } from "@/lib/link-preview";
import { rateLimit } from "@/lib/rate-limit";
import { UnsafeUrlError } from "@/lib/safe-fetch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "Sign in again to fetch link previews." }, { status: 401 });
  if (!rateLimit(`preview:${owner.id}`, 30, 60_000)) return NextResponse.json({ error: "Too many preview requests. Wait a minute." }, { status: 429 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "URL is required." }, { status: 400 });
  try {
    return NextResponse.json(await fetchLinkPreview(url));
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code && /^(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|CERT_|ERR_TLS|DEPTH_ZERO|UNABLE_TO)/.test(code)) {
      return NextResponse.json({ error: "Could not reach that URL. Check the address and try again." }, { status: 400 });
    }
    const message = error instanceof UnsafeUrlError ? error.message : error instanceof Error && /Preview request failed|did not return an HTML|timed out|Too many redirects/.test(error.message) ? error.message : userMessage(error, "Could not fetch a preview for that URL.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
