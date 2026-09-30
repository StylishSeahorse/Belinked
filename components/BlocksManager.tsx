"use client";

import { FormRestore } from "@/components/FormRestore";

import type { Block } from "@prisma/client";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { deleteBlockAction, duplicateBlockAction, saveBlockAction, saveBlockLayoutAction, toggleBlockStatusAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DateTimeField } from "@/components/DateTimeField";
import { SubmitButton } from "@/components/SubmitButton";
import { blockTypeLabels } from "@/lib/block-types";

type SerializedBlock = Omit<Block, "startsAt" | "endsAt" | "createdAt" | "updatedAt"> & {
  startsAt: string | null;
  endsAt: string | null;
};

type BlocksManagerProps = {
  blocks: SerializedBlock[];
  health: Record<string, { ok: boolean; message: string; checkedAt: string }>;
};

type BlockRow = SerializedBlock[];

function metadataGroupSize(block: SerializedBlock) {
  try {
    const parsed = JSON.parse(block.metadata || "{}") as { inlineGroupSize?: unknown };
    const size = Number(parsed.inlineGroupSize || 1);
    return size === 2 || size === 3 ? size : 1;
  } catch {
    return 1;
  }
}

function canGroupBlock(block: SerializedBlock) {
  return block.type === "LINK" && !block.featured;
}

function canDropIntoRow(row: BlockRow, block: SerializedBlock) {
  return row.length < 3 && canGroupBlock(block) && row.every(canGroupBlock);
}

function rowsFromBlocks(blocks: SerializedBlock[]) {
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

function scheduleState(block: SerializedBlock, now: number) {
  if (block.startsAt && new Date(block.startsAt).getTime() > now) return { label: "Scheduled", tone: "bg-amber-400/15 text-amber-200" };
  if (block.endsAt && new Date(block.endsAt).getTime() < now) return { label: "Expired", tone: "bg-slate-400/15 text-slate-300" };
  return null;
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "bg-emerald-400/15 text-emerald-200";
  if (status === "HIDDEN") return "bg-slate-400/15 text-slate-300";
  return "bg-violet-400/15 text-violet-200";
}

export function BlocksManager({ blocks, health }: BlocksManagerProps) {
  const router = useRouter();
  const [rows, setRows] = useState<BlockRow[]>(() => rowsFromBlocks(blocks));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [layoutMessage, setLayoutMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [savingLayout, startSaving] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setRows(rowsFromBlocks(blocks));
  }, [blocks]);

  // Computed after mount so server and client render the same markup.
  useEffect(() => setNow(Date.now()), []);

  function persistLayout(nextRows: BlockRow[]) {
    const previous = rows;
    setRows(nextRows);
    setLayoutMessage(null);
    startSaving(async () => {
      const result = await saveBlockLayoutAction(nextRows.map((row) => row.map((block) => block.id)));
      if (!result.ok) {
        setRows(previous);
        setLayoutMessage({ error: true, text: result.error || "Could not save the new order." });
        return;
      }
      setLayoutMessage({ error: false, text: "Order saved." });
      router.refresh();
    });
  }

  function moveAsOwnRow(targetRowIndex: number) {
    if (!draggingId) return;
    const extracted = extractBlock(rows, draggingId);
    if (!extracted) return;
    const insertIndex = extracted.removedRow && extracted.sourceRowIndex < targetRowIndex ? Math.max(0, targetRowIndex - 1) : targetRowIndex;
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

  function moveRow(rowIndex: number, direction: -1 | 1) {
    const target = rowIndex + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[rowIndex], next[target]] = [next[target], next[rowIndex]];
    persistLayout(next);
  }

  function ungroupRow(rowIndex: number) {
    persistLayout(rows.flatMap((row, index) => (index === rowIndex ? row.map((block) => [block]) : [row])));
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  if (!rows.length) {
    return (
      <div className="panel grid gap-2 text-center">
        <strong className="text-lg">No blocks yet</strong>
        <p className="text-sm text-black/60">Add your first link above. It will appear on your public page right away.</p>
      </div>
    );
  }

  let position = 0;

  return (
    <section className="grid gap-4" aria-label="Page blocks">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        <span>Drag by the handle or use the arrow buttons. Drop a standard link onto another to place up to three side by side.</span>
        <span role="status" aria-live="polite" className={layoutMessage?.error ? "font-semibold text-red-200" : ""}>
          {savingLayout ? "Saving order..." : layoutMessage?.text || ""}
        </span>
      </div>

      {rows.map((row, rowIndex) => (
        <div key={row.map((block) => block.id).join("-")} className="grid gap-2">
          <div
            className={`rounded-md border border-dashed transition ${draggingId ? "h-6 border-cyan-300/40 bg-cyan-300/5" : "h-2 border-transparent"}`}
            onDragOver={handleDragOver}
            onDrop={(event) => {
              event.preventDefault();
              moveAsOwnRow(rowIndex);
            }}
          />
          <div className="flex items-center justify-between gap-3 px-1 text-xs font-semibold text-slate-400">
            <span>{row.length > 1 ? `${row.length} links side by side` : ""}</span>
            <div className="flex items-center gap-1">
              {row.length > 1 ? (
                <button type="button" className="btn-secondary btn-sm" onClick={() => ungroupRow(rowIndex)} disabled={savingLayout}>
                  Ungroup
                </button>
              ) : null}
              <button type="button" className="btn-secondary btn-sm" onClick={() => moveRow(rowIndex, -1)} disabled={savingLayout || rowIndex === 0} aria-label={`Move "${row[0].title}" up`}>
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => moveRow(rowIndex, 1)}
                disabled={savingLayout || rowIndex === rows.length - 1}
                aria-label={`Move "${row[0].title}" down`}
              >
                <ArrowDown size={14} aria-hidden="true" />
              </button>
            </div>
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
            {row.map((block) => {
              position += 1;
              const schedule = now === null ? null : scheduleState(block, now);
              const warning = health[block.id] && !health[block.id].ok ? health[block.id] : null;
              return (
                <details
                  key={block.id}
                  id={`block-${block.id}`}
                  className={["panel min-w-0 scroll-mt-20 transition", draggingId === block.id ? "opacity-60 ring-2 ring-cyan-300/45" : ""].join(" ")}
                  draggable={armedId === block.id}
                  onDragStart={(event) => {
                    setDraggingId(block.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", block.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setArmedId(null);
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 font-bold">
                    <span
                      className="hidden h-9 w-9 shrink-0 cursor-grab place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 md:grid"
                      title="Drag to reorder"
                      aria-hidden="true"
                      onPointerDown={() => setArmedId(block.id)}
                      onPointerUp={() => setArmedId(null)}
                    >
                      <GripVertical size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <span className="text-slate-400">{position}.</span> {block.title}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <span className="badge bg-white/10 text-slate-200">{blockTypeLabels[block.type]}</span>
                        <span className={`badge ${statusTone(block.status)}`}>{block.status.toLowerCase()}</span>
                        {block.featured ? <span className="badge bg-cyan-400/15 text-cyan-200">featured</span> : null}
                        {schedule ? <span className={`badge ${schedule.tone}`}>{schedule.label}</span> : null}
                        {warning ? (
                          <span className="badge bg-red-500/15 text-red-200" title={warning.message}>
                            <TriangleAlert size={12} aria-hidden="true" /> link issue
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={toggleBlockStatusAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="...">
                        {block.status === "ACTIVE" ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                        {block.status === "ACTIVE" ? "Hide" : "Show"}
                      </SubmitButton>
                    </form>
                    <form action={duplicateBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="...">
                        <Copy size={14} aria-hidden="true" /> Duplicate
                      </SubmitButton>
                    </form>
                    <form action={deleteBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <ConfirmButton className="btn-danger btn-sm" message={`Delete "${block.title}"? This cannot be undone.`}>
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                  {warning ? (
                    <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-100">
                      Last link check: {warning.message}
                    </p>
                  ) : null}

                  <form action={saveBlockAction} encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-3">
                    <FormRestore id={`block-${block.id}`} />
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
                      Visibility
                      <select className="input" name="status" defaultValue={block.status}>
                        <option value="ACTIVE">Visible</option>
                        <option value="HIDDEN">Hidden</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </label>
                    <DateTimeField name="startsAt" label="Show from (optional)" defaultValue={block.startsAt} />
                    <DateTimeField name="endsAt" label="Hide after (optional)" defaultValue={block.endsAt} />
                    <div className="flex gap-2 md:col-span-3">
                      <SubmitButton>Save block</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        </div>
      ))}

      <div
        className={`rounded-md border border-dashed transition ${draggingId ? "h-8 border-cyan-300/40 bg-cyan-300/5" : "h-2 border-transparent"}`}
        onDragOver={handleDragOver}
        onDrop={(event) => {
          event.preventDefault();
          moveAsOwnRow(rows.length);
        }}
      />
    </section>
  );
}
