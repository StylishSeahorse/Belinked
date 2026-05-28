"use client";

import type { Block } from "@prisma/client";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { deleteBlockAction, reorderBlocksAction, saveBlockAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { SubmitButton } from "@/components/SubmitButton";

type BlocksManagerProps = {
  blocks: Block[];
};

export function BlocksManager({ blocks }: BlocksManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(blocks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const orderedIdsRef = useRef<string[]>(blocks.map((block) => block.id));

  useEffect(() => {
    orderedIdsRef.current = items.map((block) => block.id);
  }, [items]);

  function moveItem(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    setItems((current) => {
      const sourceIndex = current.findIndex((block) => block.id === draggingId);
      const targetIndex = current.findIndex((block) => block.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((block, index) => ({ ...block, position: index + 1 }));
    });
  }

  function nudgeItem(id: string, direction: -1 | 1) {
    const index = items.findIndex((block) => block.id === id);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    const normalized = next.map((block, itemIndex) => ({ ...block, position: itemIndex + 1 }));
    setItems(normalized);
    persistOrder(normalized.map((block) => block.id));
  }

  function persistOrder(nextIds: string[]) {
    setSavingOrder(true);
    startTransition(async () => {
      try {
        await reorderBlocksAction(nextIds);
        router.refresh();
      } finally {
        setSavingOrder(false);
      }
    });
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        <span>Drag blocks by the handle to reorder them.</span>
        <span>{savingOrder ? "Saving order..." : "Order saves after drop."}</span>
      </div>
      {items.map((block) => (
        <details
          key={block.id}
          className={[
            "panel transition",
            draggingId === block.id ? "opacity-70 ring-2 ring-cyan-300/45" : "",
            savingOrder ? "pointer-events-none" : ""
          ].join(" ")}
          draggable
          onDragStart={() => setDraggingId(block.id)}
          onDragOver={(event) => {
            event.preventDefault();
            moveItem(block.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggingId(null);
            persistOrder(orderedIdsRef.current);
          }}
          onDragEnd={() => {
            if (!draggingId) return;
            setDraggingId(null);
            persistOrder(orderedIdsRef.current);
          }}
        >
          <summary className="flex cursor-pointer items-center gap-3 font-bold">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              {block.position}. {block.title} <span className="text-xs text-black/50">{block.type} / {block.status}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-secondary h-9 w-9 p-0"
                onClick={(event) => {
                  event.preventDefault();
                  nudgeItem(block.id, -1);
                }}
                disabled={savingOrder || block.position === 1}
                title="Move up"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="btn-secondary h-9 w-9 p-0"
                onClick={(event) => {
                  event.preventDefault();
                  nudgeItem(block.id, 1);
                }}
                disabled={savingOrder || block.position === items.length}
                title="Move down"
              >
                <ArrowDown size={15} />
              </button>
            </div>
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
    </section>
  );
}
