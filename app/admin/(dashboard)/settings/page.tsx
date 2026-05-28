import Link from "next/link";
import { changePasswordAction } from "@/app/actions";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
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
      <SmtpSettingsForm platform={platform} smtp={smtp} />
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
