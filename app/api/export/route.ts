import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => esc(row[header])).join(","))].join("\n");
}

export async function GET(request: Request) {
  await requireOwner();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const format = url.searchParams.get("format") || "json";
  if (type === "blocks-template") {
    return new Response("type,title,url,description,position,status\nLINK,Example,https://example.com,Description,1,ACTIVE\n", {
      headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=blocks-template.csv" }
    });
  }
  const data =
    type === "analytics"
      ? await prisma.event.findMany({ orderBy: { createdAt: "desc" } })
      : {
          owners: await prisma.owner.findMany({ select: { id: true, email: true, displayName: true, createdAt: true } }),
          profiles: await prisma.profile.findMany(),
          blocks: await prisma.block.findMany(),
          socials: await prisma.socialIcon.findMany(),
          themes: await prisma.theme.findMany(),
          shortLinks: await prisma.shortLink.findMany(),
          subscribers: await prisma.subscriber.findMany(),
          events: await prisma.event.findMany(),
          settings: await prisma.appSetting.findMany(),
          auditLogs: await prisma.auditLog.findMany()
        };
  if (format === "csv" && Array.isArray(data)) {
    return new Response(csv(data), {
      headers: { "content-type": "text/csv", "content-disposition": `attachment; filename=${type}.csv` }
    });
  }
  return Response.json(data, {
    headers: { "content-disposition": `attachment; filename=${type}.json` }
  });
}
