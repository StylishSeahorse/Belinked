import { saveBlockAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { BlocksManager } from "@/components/BlocksManager";
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
      <BlocksManager blocks={blocks} />
    </div>
  );
}
