import { FormRestore } from "@/components/FormRestore";
import { deleteShortLinkAction, saveShortLinkAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DateTimeField } from "@/components/DateTimeField";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short links" };

export default async function ShortLinksPage() {
  await requireOwner();
  const [links, base, clicks] = await Promise.all([
    prisma.shortLink.findMany({ orderBy: { createdAt: "desc" } }),
    siteUrl(),
    prisma.event.groupBy({ by: ["shortCode"], where: { type: "SHORT_LINK_CLICK", isBot: false }, _count: { _all: true } })
  ]);
  const clickCount = new Map(clicks.map((row) => [row.shortCode, row._count._all]));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-black">Short links</h1>
        <p className="text-sm text-black/60">Memorable redirects like {base}/s/tour that you can share anywhere and track.</p>
      </div>
      <form action={saveShortLinkAction} className="panel grid gap-4 md:grid-cols-3">
        <FormRestore id="short-new" />
        <h2 className="text-lg font-black md:col-span-3">New short link</h2>
        <label className="field">Code<input className="input" name="code" placeholder="launch" pattern="[a-zA-Z0-9_\-]{2,40}" required /><span className="text-xs text-black/55">Letters, numbers, - and _</span></label>
        <label className="field md:col-span-2">Destination<input className="input" name="destination" type="url" placeholder="https://example.com" required /></label>
        <label className="field">Description<input className="input" name="description" maxLength={160} /></label>
        <DateTimeField name="startsAt" label="Active from (optional)" />
        <DateTimeField name="endsAt" label="Expires (optional)" />
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isActive" defaultChecked /> Active</label>
        <div className="md:col-span-3"><SubmitButton pendingLabel="Creating...">Create short link</SubmitButton></div>
      </form>
      <section className="grid gap-3" aria-label="Short links">
        {links.length ? null : <div className="panel text-sm text-black/60">No short links yet.</div>}
        {links.map((link) => (
          <details key={link.id} className="panel">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 font-bold">
              <span className="font-mono">/s/{link.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-normal text-black/60">{link.destination}</span>
              <span className="badge bg-white/10 text-slate-200">{clickCount.get(link.code) || 0} clicks</span>
              {!link.isActive ? <span className="badge bg-slate-400/15 text-slate-300">inactive</span> : null}
            </summary>
            <form action={saveShortLinkAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <input type="hidden" name="id" value={link.id} />
              <label className="field">Code<input className="input" name="code" defaultValue={link.code} pattern="[a-zA-Z0-9_\-]{2,40}" required /></label>
              <label className="field md:col-span-2">Destination<input className="input" name="destination" type="url" defaultValue={link.destination} required /></label>
              <label className="field">Description<input className="input" name="description" defaultValue={link.description || ""} maxLength={160} /></label>
              <DateTimeField name="startsAt" label="Active from" defaultValue={link.startsAt?.toISOString()} />
              <DateTimeField name="endsAt" label="Expires" defaultValue={link.endsAt?.toISOString()} />
              <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isActive" defaultChecked={link.isActive} /> Active</label>
              <div className="flex flex-wrap gap-2 md:col-span-3">
                <SubmitButton>Save</SubmitButton>
                <a className="btn-secondary" href={`/s/${link.code}`} target="_blank" rel="noopener">Open</a>
                <ConfirmButton formAction={deleteShortLinkAction} message={`Delete /s/${link.code}? Anyone using this link will get a "not found" page.`}>Delete</ConfirmButton>
              </div>
            </form>
          </details>
        ))}
      </section>
    </div>
  );
}
