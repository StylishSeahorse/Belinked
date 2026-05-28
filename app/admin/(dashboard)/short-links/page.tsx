import { saveShortLinkAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ShortLinksPage() {
  await requireOwner();
  const links = await prisma.shortLink.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-black">Short links and redirects</h1>
      <form action={saveShortLinkAction} className="panel grid gap-4 md:grid-cols-3">
        <label className="field">Code<input className="input" name="code" placeholder="launch" required /></label>
        <label className="field md:col-span-2">Destination<input className="input" name="destination" placeholder="https://example.com" required /></label>
        <label className="field">Description<input className="input" name="description" /></label>
        <label className="field">Starts at<input className="input" name="startsAt" type="datetime-local" /></label>
        <label className="field">Ends at<input className="input" name="endsAt" type="datetime-local" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isActive" defaultChecked /> Active</label>
        <div className="md:col-span-3"><SubmitButton>Create short link</SubmitButton></div>
      </form>
      <section className="grid gap-3">
        {links.map((link) => (
          <form key={link.id} action={saveShortLinkAction} className="panel grid gap-3 md:grid-cols-3">
            <input type="hidden" name="id" value={link.id} />
            <label className="field">Code<input className="input" name="code" defaultValue={link.code} /></label>
            <label className="field md:col-span-2">Destination<input className="input" name="destination" defaultValue={link.destination} /></label>
            <label className="field">Description<input className="input" name="description" defaultValue={link.description || ""} /></label>
            <label className="field">Starts at<input className="input" name="startsAt" type="datetime-local" defaultValue={link.startsAt?.toISOString().slice(0, 16)} /></label>
            <label className="field">Ends at<input className="input" name="endsAt" type="datetime-local" defaultValue={link.endsAt?.toISOString().slice(0, 16)} /></label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="isActive" defaultChecked={link.isActive} /> Active</label>
            <a className="btn-secondary" href={`/s/${link.code}`} target="_blank">Open /s/{link.code}</a>
            <SubmitButton>Save</SubmitButton>
          </form>
        ))}
      </section>
    </div>
  );
}
