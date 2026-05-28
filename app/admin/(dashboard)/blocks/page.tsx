import { deleteBlockAction, saveBlockAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  await requireOwner();
  const blocks = await prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-black">Blocks</h1>
      <form action={saveBlockAction} encType="multipart/form-data" className="panel grid gap-4 md:grid-cols-3">
        <BlockTypeFields />
        <label className="field">Position<input className="input" name="position" type="number" defaultValue={blocks.length + 1} /></label>
        <label className="field">Status<select className="input" name="status"><option>ACTIVE</option><option>HIDDEN</option><option>ARCHIVED</option></select></label>
        <label className="field">Starts at<input className="input" name="startsAt" type="datetime-local" /></label>
        <label className="field">Ends at<input className="input" name="endsAt" type="datetime-local" /></label>
        <div className="md:col-span-3"><SubmitButton>Add block</SubmitButton></div>
      </form>
      <section className="grid gap-3">
        {blocks.map((block) => (
          <details key={block.id} className="panel">
            <summary className="cursor-pointer font-bold">{block.position}. {block.title} <span className="text-xs text-black/50">{block.type} / {block.status}</span></summary>
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
              <label className="field">Position<input className="input" name="position" type="number" defaultValue={block.position} /></label>
              <label className="field">Status<select className="input" name="status" defaultValue={block.status}><option>ACTIVE</option><option>HIDDEN</option><option>ARCHIVED</option></select></label>
              <label className="field">Starts at<input className="input" name="startsAt" type="datetime-local" defaultValue={block.startsAt?.toISOString().slice(0, 16)} /></label>
              <label className="field">Ends at<input className="input" name="endsAt" type="datetime-local" defaultValue={block.endsAt?.toISOString().slice(0, 16)} /></label>
              <div className="flex gap-2 md:col-span-3"><SubmitButton>Save block</SubmitButton></div>
            </form>
            <form action={deleteBlockAction} className="mt-3">
              <input type="hidden" name="id" value={block.id} />
              <button className="btn-secondary">Delete</button>
            </form>
          </details>
        ))}
      </section>
    </div>
  );
}
