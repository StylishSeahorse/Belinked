import Link from "next/link";
import { changePasswordAction, saveSettingsAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parse(value?: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export default async function SettingsPage() {
  await requireOwner();
  const [setting, auditLogs] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "platform" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
  ]);
  const platform = parse(setting?.value);
  const smtp = platform.smtp || {};
  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-3xl font-black">Settings</h1>
      <form action={saveSettingsAction} className="panel grid gap-4 md:grid-cols-2">
        <label className="field">Platform name<input className="input" name="name" defaultValue={platform.name || "Belinked"} /></label>
        <label className="field">Support URL<input className="input" name="supportUrl" defaultValue={platform.supportUrl || ""} /></label>
        <label className="field md:col-span-2">Footer text<input className="input" name="footerText" defaultValue={platform.footerText || ""} /></label>
        <div className="rounded-md border border-black/10 bg-black/[.03] p-3 text-sm font-semibold text-black/65 md:col-span-2">
          Storage is always local for this self-hosted app.
        </div>
        <label className="field">Email provider<select className="input" name="emailProvider" defaultValue={platform.emailProvider || "disabled"}><option>disabled</option><option>smtp</option></select></label>
        <label className="field">SMTP host<input className="input" name="smtpHost" defaultValue={smtp.host || ""} placeholder="smtp.example.com" /></label>
        <label className="field">SMTP port<input className="input" name="smtpPort" type="number" defaultValue={smtp.port || 587} /></label>
        <label className="field">SMTP username<input className="input" name="smtpUser" defaultValue={smtp.user || ""} /></label>
        <label className="field">SMTP password<input className="input" name="smtpPassword" type="password" placeholder={smtp.password ? "Saved; leave blank to keep" : ""} /></label>
        <label className="field">From name<input className="input" name="smtpFromName" defaultValue={smtp.fromName || platform.name || "Belinked"} /></label>
        <label className="field">From email<input className="input" name="smtpFromEmail" type="email" defaultValue={smtp.fromEmail || ""} placeholder="noreply@example.com" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input className="w-auto" type="checkbox" name="smtpSecure" defaultChecked={Boolean(smtp.secure)} /> Use TLS/SSL</label>
        <div className="md:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
      </form>
      <form action={changePasswordAction} className="panel grid gap-4">
        <h2 className="text-xl font-black">Password</h2>
        <label className="field">New password<input className="input" name="password" type="password" minLength={12} required /></label>
        <SubmitButton>Change password</SubmitButton>
      </form>
      <section className="panel grid gap-3">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-black">Data and health</h2>
          <div className="flex gap-2"><Link className="btn-secondary" href="/api/export?type=all&format=json">Export all data</Link><Link className="btn-secondary" href="/api/export?type=blocks-template&format=csv">CSV template</Link></div>
        </div>
        <p className="text-sm text-black/60">SQLite database reachable, local storage configured, SMTP optional. Reset/delete should be performed with filesystem/database backups in place.</p>
      </section>
      <section className="panel">
        <h2 className="mb-3 text-xl font-black">Audit logs</h2>
        <div className="grid gap-2 text-sm">{auditLogs.map((log) => <p key={log.id} className="flex justify-between border-b border-black/10 py-2"><span>{log.action}</span><span>{log.createdAt.toLocaleString()}</span></p>)}</div>
      </section>
    </div>
  );
}
