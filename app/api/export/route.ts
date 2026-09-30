import { requireOwner } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";
import { LINK_CSV_TEMPLATE, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function attachment(filename: string) {
  return { "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" };
}

export async function GET(request: Request) {
  await requireOwner();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const format = url.searchParams.get("format") || "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "blocks-template") {
    return new Response(LINK_CSV_TEMPLATE, { headers: { "content-type": "text/csv; charset=utf-8", ...attachment("links-template.csv") } });
  }

  if (type === "analytics") {
    const days = Number(url.searchParams.get("days") || 0);
    const events = await prisma.event.findMany({
      where: days > 0 ? { createdAt: { gte: new Date(Date.now() - Math.min(days, 3650) * 86_400_000) } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { block: { select: { title: true } } }
    });
    const rows = events.map(({ block, ipHash: _ipHash, ...event }) => {
      void _ipHash;
      return { ...event, blockTitle: block?.title ?? "" };
    });
    if (format === "csv") return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", ...attachment(`belinked-analytics-${stamp}.csv`) } });
    return Response.json(rows, { headers: attachment(`belinked-analytics-${stamp}.json`) });
  }

  if (type === "subscribers") {
    const subscribers = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
    if (format === "csv") return new Response(toCsv(subscribers), { headers: { "content-type": "text/csv; charset=utf-8", ...attachment(`belinked-subscribers-${stamp}.csv`) } });
    return Response.json(subscribers, { headers: attachment(`belinked-subscribers-${stamp}.json`) });
  }

  if (type === "links") {
    const blocks = await prisma.block.findMany({ where: { type: "LINK" }, orderBy: { position: "asc" } });
    return new Response(toCsv(blocks.map((block) => ({ title: block.title, url: block.url, description: block.description, status: block.status }))), {
      headers: { "content-type": "text/csv; charset=utf-8", ...attachment(`belinked-links-${stamp}.csv`) }
    });
  }

  const backup = await buildBackup({ includeAnalytics: url.searchParams.get("analytics") === "1" });
  return Response.json(backup, { headers: attachment(`belinked-backup-${stamp}.json`) });
}
