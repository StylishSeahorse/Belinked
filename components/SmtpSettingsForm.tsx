"use client";

import { useActionState } from "react";
import { saveSettingsAction, testSmtpSettingsAction, type SmtpTestActionState } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

type SmtpSettingsFormProps = {
  platform: Record<string, unknown>;
  smtp: Record<string, unknown>;
};

const initialState: SmtpTestActionState = null;

function text(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function SmtpSettingsForm({ platform, smtp }: SmtpSettingsFormProps) {
  const [testState, testAction, isTesting] = useActionState(testSmtpSettingsAction, initialState);

  return (
    <form action={saveSettingsAction} className="panel grid gap-4 md:grid-cols-2">
      <label className="field">
        Platform name
        <input className="input" name="name" defaultValue={text(platform.name, "Belinked")} />
      </label>
      <label className="field">
        Support URL
        <input className="input" name="supportUrl" defaultValue={text(platform.supportUrl)} />
      </label>
      <label className="field md:col-span-2">
        Footer text
        <input className="input" name="footerText" defaultValue={text(platform.footerText)} />
      </label>
      <div className="rounded-md border border-white/10 bg-white/[.04] p-3 text-sm font-semibold text-white/65 md:col-span-2">
        Storage is always local for this self-hosted app.
      </div>
      <label className="field">
        Email provider
        <select className="input" name="emailProvider" defaultValue={text(platform.emailProvider, "disabled")}>
          <option value="disabled">disabled</option>
          <option value="smtp">smtp</option>
        </select>
      </label>
      <label className="field">
        SMTP host
        <input className="input" name="smtpHost" defaultValue={text(smtp.host)} placeholder="smtp.example.com" />
      </label>
      <label className="field">
        SMTP port
        <input className="input" name="smtpPort" type="number" min={1} max={65535} defaultValue={text(smtp.port, "587")} />
      </label>
      <label className="field">
        SMTP username
        <input className="input" name="smtpUser" defaultValue={text(smtp.user)} autoComplete="username" />
      </label>
      <label className="field">
        SMTP password
        <input className="input" name="smtpPassword" type="password" placeholder={smtp.password ? "Saved; leave blank to keep" : ""} autoComplete="current-password" />
      </label>
      <label className="field">
        From name
        <input className="input" name="smtpFromName" defaultValue={text(smtp.fromName, text(platform.name, "Belinked"))} />
      </label>
      <label className="field">
        From email
        <input className="input" name="smtpFromEmail" type="email" defaultValue={text(smtp.fromEmail)} placeholder="noreply@example.com" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <input className="w-auto" type="checkbox" name="smtpSecure" defaultChecked={Boolean(smtp.secure)} /> Use TLS/SSL
      </label>
      {testState ? (
        <div className={`rounded-md border p-3 text-sm font-semibold md:col-span-2 ${testState.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>
          {testState.message}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <SubmitButton>Save settings</SubmitButton>
        <button className="btn-secondary" formAction={testAction} disabled={isTesting}>
          {isTesting ? "Testing..." : "Test SMTP connection"}
        </button>
      </div>
    </form>
  );
}
