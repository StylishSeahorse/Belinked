import { readPlatformSettings, writePlatformSettings } from "./platform-settings";
import { prisma } from "./prisma";
import { safeFetch } from "./safe-fetch";

export type LinkHealthResult = { blockId: string; url: string; ok: boolean; status: number | null; message: string; checkedAt: string };

async function checkUrl(url: string): Promise<Omit<LinkHealthResult, "blockId" | "checkedAt">> {
  if (!/^https?:/i.test(url)) return { url, ok: true, status: null, message: "Not an http(s) link; not checked." };
  try {
    let response = await safeFetch(url, { method: "HEAD", timeoutMs: 6000, maxBytes: 1 });
    // Many sites reject HEAD; retry with a small GET.
    if (response.status === 405 || response.status === 403 || response.status === 501) {
      response = await safeFetch(url, { method: "GET", timeoutMs: 6000, maxBytes: 16_000 });
    }
    const ok = response.status >= 200 && response.status < 400;
    return { url, ok, status: response.status, message: ok ? "Reachable" : `Responded with HTTP ${response.status}` };
  } catch (error) {
    return { url, ok: false, status: null, message: error instanceof Error ? error.message : "Unreachable" };
  }
}

/** Checks every link-bearing block (4 at a time) and stores the results in settings. */
export async function checkLinkHealth(): Promise<LinkHealthResult[]> {
  const blocks = await prisma.block.findMany({ where: { url: { not: null }, status: { not: "ARCHIVED" } }, select: { id: true, url: true }, take: 200 });
  const results: LinkHealthResult[] = [];
  const queue = [...blocks];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let block = queue.shift(); block; block = queue.shift()) {
        results.push({ blockId: block.id, checkedAt: new Date().toISOString(), ...(await checkUrl(block.url || "")) });
      }
    })
  );
  const settings = await readPlatformSettings();
  await writePlatformSettings({ ...settings, linkHealth: results });
  return results;
}

export async function readLinkHealth(): Promise<Record<string, LinkHealthResult>> {
  const settings = await readPlatformSettings();
  const list = Array.isArray(settings.linkHealth) ? (settings.linkHealth as LinkHealthResult[]) : [];
  return Object.fromEntries(list.map((result) => [result.blockId, result]));
}
