import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "Sign in again to fetch link previews." }, { status: 401 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "URL is required." }, { status: 400 });
  try {
    return NextResponse.json(await fetchLinkPreview(url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not fetch preview." }, { status: 400 });
  }
}
