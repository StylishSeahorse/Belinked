import { FormRestore } from "@/components/FormRestore";
import { Download, Plus, Upload } from "lucide-react";
import { checkLinksAction, importLinksCsvAction, saveBlockAction } from "@/app/actions";
import { BlockTypeFields } from "@/components/BlockTypeFields";
import { BlocksManager } from "@/components/BlocksManager";
import { DateTimeField } from "@/components/DateTimeField";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { readLinkHealth } from "@/lib/link-health";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links & blocks" };

export default async function BlocksPage() {
  await requireOwner();
  const [blocks, health] = await Promise.all([prisma.block.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }), readLinkHealth()]);
  const serialized = blocks.map(({ startsAt, endsAt, createdAt: _createdAt, updatedAt: _updatedAt, ...block }) => {
    void _createdAt;
    void _updatedAt;
    return { ...block, startsAt: startsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null };
  });
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Links &amp; blocks</h1>
          <p className="text-sm text-black/60">Everything on your public page, in order. New blocks are added to the end.</p>
        </div>
        <a className="btn-secondary" href="/" target="_blank" rel="noopener">Preview page</a>
      </div>

      <details id="add-block" className="panel" open={blocks.length === 0}>
        <summary className="flex cursor-pointer items-center gap-2 text-lg font-black">
          <Plus size={18} aria-hidden="true" /> Add a block
        </summary>
        <form action={saveBlockAction} encType="multipart/form-data" className="mt-4 grid gap-4 md:grid-cols-3">
          <FormRestore id="block-new" />
          <BlockTypeFields />
          <label className="field">
            Visibility
            <select className="input" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Visible</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </label>
          <DateTimeField name="startsAt" label="Show from (optional)" />
          <DateTimeField name="endsAt" label="Hide after (optional)" />
          <div className="md:col-span-3">
            <SubmitButton pendingLabel="Adding...">Add block</SubmitButton>
          </div>
        </form>
      </details>

      <BlocksManager blocks={serialized} health={health} />

      <section className="panel grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <h2 className="text-lg font-black">Link health</h2>
          <p className="text-sm text-black/60">Checks that every link still responds. Problems are flagged on the affected blocks.</p>
          <form action={checkLinksAction}>
            <SubmitButton className="btn-secondary" pendingLabel="Checking links...">Check all links</SubmitButton>
          </form>
        </div>
        <form action={importLinksCsvAction} encType="multipart/form-data" className="grid content-start gap-2">
          <h2 className="text-lg font-black">Import links from CSV</h2>
          <p className="text-sm text-black/60">Columns: title, url, description. Imported links start hidden so you can review them.</p>
          <input className="input" type="file" name="csvFile" accept=".csv,text/csv" required aria-label="CSV file" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn-secondary" pendingLabel="Importing...">
              <Upload size={14} aria-hidden="true" /> Import
            </SubmitButton>
            <a className="btn-secondary" download href="/api/export?type=blocks-template&format=csv">
              <Download size={14} aria-hidden="true" /> Template
            </a>
            <a className="btn-secondary" download href="/api/export?type=links&format=csv">
              <Download size={14} aria-hidden="true" /> Export links
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}
