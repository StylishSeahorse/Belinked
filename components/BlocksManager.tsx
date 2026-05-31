"use client";

import type { Block } from "@prisma/client";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { startTransition, useEffect, useState } from "react";
import { deleteBlockAction, saveBlockAction, saveBlockLayoutAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { SubmitButton } from "@/components/SubmitButton";

type BlocksManagerProps = {
  blocks: Block[];
};

type BlockRow = Block[];

function metadataGroupSize(block: Block) {
  try {
    const parsed = JSON.parse(block.metadata || "{}") as { inlineGroupSize?: unknown };
    const size = Number(parsed.inlineGroupSize || 1);
    return size === 2 || size === 3 ? size : 1;
  } catch {
    return 1;
  }
}

function canGroupBlock(block: Block) {
  return block.type === "LINK" && !block.featured;
}

function canDropIntoRow(row: BlockRow, block: Block) {
  return row.length < 3 && canGroupBlock(block) && row.every(canGroupBlock);
}

function rowsFromBlocks(blocks: Block[]) {
  const rows: BlockRow[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const groupSize = canGroupBlock(block) ? metadataGroupSize(block) : 1;
    const row = [block];
    if (groupSize > 1) {
      for (let offset = 1; offset < groupSize; offset += 1) {
        const next = blocks[index + offset];
        if (!next || !canGroupBlock(next)) break;
        row.push(next);
      }
    }
    rows.push(row);
    index += row.length - 1;
  }
  return rows;
}

function rowsWithPositions(rows: BlockRow[]) {
  let position = 1;
  return rows.map((row) =>
    row.map((block) => ({
      ...block,
      position: position++
    }))
  );
}

function extractBlock(rows: BlockRow[], id: string) {
  const next = rows.map((row) => [...row]);
  for (let rowIndex = 0; rowIndex < next.length; rowIndex += 1) {
    const blockIndex = next[rowIndex].findIndex((block) => block.id === id);
    if (blockIndex === -1) continue;
    const [block] = next[rowIndex].splice(blockIndex, 1);
    const removedRow = next[rowIndex].length === 0;
    if (removedRow) next.splice(rowIndex, 1);
    return { block, next, removedRow, sourceRowIndex: rowIndex };
  }
  return null;
}

function rowClass(row: BlockRow) {
  if (row.length === 1) return "grid gap-3";
  if (row.length === 2) return "grid gap-3 md:grid-cols-2";
  return "grid gap-3 md:grid-cols-3";
}

export function BlocksManager({ blocks }: BlocksManagerProps) {
  const router = useRouter();
  const [rows, setRows] = useState<BlockRow[]>(() => rowsFromBlocks(blocks));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    setRows(rowsFromBlocks(blocks));
  }, [blocks]);

  function persistLayout(nextRows: BlockRow[]) {
    const positioned = rowsWithPositions(nextRows);
    setRows(positioned);
    setSavingLayout(true);
    startTransition(async () => {
      try {
        await saveBlockLayoutAction(positioned.map((row) => row.map((block) => block.id)));
        router.refresh();
      } finally {
        setSavingLayout(false);
      }
    });
  }

  function moveAsOwnRow(targetRowIndex: number) {
    if (!draggingId) return;
    const extracted = extractBlock(rows, draggingId);
    if (!extracted) return;
    const insertIndex =
      extracted.removedRow && extracted.sourceRowIndex < targetRowIndex ? Math.max(0, targetRowIndex - 1) : targetRowIndex;
    const next = [...extracted.next];
    next.splice(Math.min(insertIndex, next.length), 0, [extracted.block]);
    setDraggingId(null);
    persistLayout(next);
  }

  function moveIntoRow(targetRowIndex: number) {
    if (!draggingId) return;
    const targetAnchorId = rows[targetRowIndex]?.[0]?.id;
    if (!targetAnchorId) return;
    const extracted = extractBlock(rows, draggingId);
    if (!extracted) return;
    const targetIndex = extracted.next.findIndex((row) => row.some((block) => block.id === targetAnchorId));
    if (targetIndex === -1 || !canDropIntoRow(extracted.next[targetIndex], extracted.block)) {
      setDraggingId(null);
      return;
    }
    const next = [...extracted.next];
    next[targetIndex] = [...next[targetIndex], extracted.block];
    setDraggingId(null);
    persistLayout(next);
  }

  function ungroupRow(rowIndex: number) {
    const next = rows.flatMap((row, index) => (index === rowIndex ? row.map((block) => [block]) : [row]));
    persistLayout(next);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        <span>Drag a block onto a row to place it beside another link. Rows can hold up to three standard links.</span>
        <span>{savingLayout ? "Saving layout..." : "Layout saves after drop."}</span>
      </div>

      {rows.map((row, rowIndex) => (
        <div key={row.map((block) => block.id).join("-")} className="grid gap-2">
          <div
            className="h-4 rounded-md border border-dashed border-white/10 bg-white/[0.02]"
            title="Drop here to make a new single row"
            onDragOver={handleDragOver}
            onDrop={(event) => {
              event.preventDefault();
              moveAsOwnRow(rowIndex);
            }}
          />
          <div className="flex items-center justify-between gap-3 px-1 text-xs font-semibold text-slate-400">
            <span>{row.length > 1 ? `${row.length} links grouped` : "Single row"}</span>
            {row.length > 1 ? (
              <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => ungroupRow(rowIndex)} disabled={savingLayout}>
                Ungroup
              </button>
            ) : null}
          </div>
          <div
            className={rowClass(row)}
            onDragOver={(event) => {
              if (!draggingId) return;
              const dragging = rows.flat().find((block) => block.id === draggingId);
              if (dragging && canDropIntoRow(row, dragging)) handleDragOver(event);
            }}
            onDrop={(event) => {
              event.preventDefault();
              moveIntoRow(rowIndex);
            }}
          >
            {row.map((block) => (
              <details
                key={block.id}
                className={[
                  "panel min-w-0 transition",
                  draggingId === block.id ? "opacity-70 ring-2 ring-cyan-300/45" : "",
                  savingLayout ? "pointer-events-none" : ""
                ].join(" ")}
                draggable
                onDragStart={(event) => {
                  setDraggingId(block.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", block.id);
                }}
                onDragEnd={() => setDraggingId(null)}
              >
                <summary className="flex cursor-pointer items-center gap-3 font-bold">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300"
                    title="Drag to arrange"
                  >
                    <GripVertical size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {block.position}. {block.title} <span className="text-xs text-black/50">{block.type} / {block.status}</span>
                  </span>
                </summary>
                <form action={saveBlockAction} encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="id" value={block.id} />
                  <BlockTypeFields
                    defaultType={block.type}
                    defaultTitle={block.title}
                    defaultDescription={block.description || ""}
                    defaultUrl={block.url || ""}
                    defaultImageUrl={block.imageUrl || ""}
                    defaultMetadata={block.metadata}
                    defaultFeatured={block.featured}
                    defaultAnimation={block.animation || ""}
                    defaultInternalNote={block.internalNote || ""}
                    defaultUtmSource={block.utmSource || ""}
                    defaultUtmMedium={block.utmMedium || ""}
                    defaultUtmCampaign={block.utmCampaign || ""}
                  />
                  <label className="field">
                    Position
                    <input className="input" name="position" type="number" defaultValue={block.position} />
                  </label>
                  <label className="field">
                    Status
                    <select className="input" name="status" defaultValue={block.status}>
                      <option>ACTIVE</option>
                      <option>HIDDEN</option>
                      <option>ARCHIVED</option>
                    </select>
                  </label>
                  <label className="field">
                    Starts at
                    <input className="input" name="startsAt" type="datetime-local" defaultValue={block.startsAt?.toISOString().slice(0, 16)} />
                  </label>
                  <label className="field">
                    Ends at
                    <input className="input" name="endsAt" type="datetime-local" defaultValue={block.endsAt?.toISOString().slice(0, 16)} />
                  </label>
                  <div className="flex gap-2 md:col-span-3">
                    <SubmitButton>Save block</SubmitButton>
                  </div>
                </form>
                <form action={deleteBlockAction} className="mt-3">
                  <input type="hidden" name="id" value={block.id} />
                  <button className="btn-secondary">Delete</button>
                </form>
              </details>
            ))}
          </div>
        </div>
      ))}

      <div
        className="h-7 rounded-md border border-dashed border-white/10 bg-white/[0.02]"
        title="Drop here to move to the end as a single row"
        onDragOver={handleDragOver}
        onDrop={(event) => {
          event.preventDefault();
          moveAsOwnRow(rows.length);
        }}
      />
    </section>
  );
}
