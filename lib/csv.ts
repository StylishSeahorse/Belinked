import { BlockType } from "@prisma/client";
import { prisma } from "./prisma";
import { UserError } from "./errors";
import { safeHref } from "./validation";

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = input.replace(/^﻿/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

/** Neutralizes spreadsheet formula injection in exported cells. */
export function csvCell(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

export const LINK_CSV_TEMPLATE = "title,url,description\nMy website,https://example.com,Optional description\n";

/** Appends LINK blocks from a CSV with a `title,url[,description]` header. New links start hidden. */
export async function importLinksFromCsv(input: string) {
  const [header, ...rows] = parseCsv(input);
  const columns = (header || []).map((value) => value.trim().toLowerCase());
  const titleIndex = columns.indexOf("title");
  const urlIndex = columns.indexOf("url");
  const descriptionIndex = columns.indexOf("description");
  if (titleIndex === -1 || urlIndex === -1) {
    throw new UserError("The CSV needs a header row with at least 'title' and 'url' columns.");
  }
  const valid = rows.slice(0, 500).flatMap((row) => {
    const title = (row[titleIndex] || "").trim().slice(0, 120);
    const url = safeHref((row[urlIndex] || "").trim());
    if (!title || !url) return [];
    return [{ title, url, description: descriptionIndex === -1 ? null : (row[descriptionIndex] || "").trim().slice(0, 400) || null }];
  });
  const last = await prisma.block.aggregate({ _max: { position: true } });
  let position = last._max.position || 0;
  await prisma.$transaction(
    valid.map((link) => prisma.block.create({ data: { ...link, type: BlockType.LINK, status: "HIDDEN", position: (position += 1) } }))
  );
  return { created: valid.length, skipped: Math.min(rows.length, 500) - valid.length };
}
