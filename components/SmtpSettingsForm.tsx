"use client";

import { useActionState } from "react";
import { saveSettingsAction, testSmtpSettingsAction, type SmtpTestActionState } from "@/app/actions";
import { FormRestore } from "@/components/FormRestore";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: SmtpTestActionState = null;

function text(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

/** Settings → Email. Secrets arrive redacted ("__set__"), never as real values. */
export function SmtpSettingsForm({ platform, smtp }: { platform: Record<string, unknown>; smtp: Record<string, unknown> }) {
  const [testState, testAction, isTesting] = useActionState(testSmtpSettingsAction, initialState);

  return (
    <form action={saveSettingsAction} className="grid gap-4 md:grid-cols-2">
      <FormRestore id="settings-email" />
      <input type="hidden" name="section" value="email" />
      <label className="field md:col-span-2">
        Sending email
        <select className="input" name="emailProvider" defaultValue={text(platform.emailProvider, "disabled")}>
          <option value="disabled">Off</option>
          <option value="smtp">Send through an SMTP server</option>
        </select>
        <span className="field-hint">Optional. Used for connection tests today; your page works without it.</span>
      </label>
      <label className="field">
        Server (host)
        <input className="input" name="smtpHost" defaultValue={text(smtp.host)} placeholder="smtp.example.com" />
      </label>
      <label className="field">
        Port
        <input className="input" name="smtpPort" type="number" min={1} max={65535} defaultValue={text(smtp.port, "587")} />
      </label>
      <label className="field">
        Username
        <input className="input" name="smtpUser" defaultValue={text(smtp.user)} autoComplete="off" />
      </label>
      <label className="field">
        Password
        <input className="input" name="smtpPassword" type="password" placeholder={smtp.password ? "Saved. Leave blank to keep it." : ""} autoComplete="new-password" />
        {smtp.password ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
            <input className="w-auto" type="checkbox" name="clearSmtpPassword" /> Forget the saved password
          </span>
        ) : null}
      </label>
      <label className="field">
        From name
        <input className="input" name="smtpFromName" defaultValue={text(smtp.fromName)} />
      </label>
      <label className="field">
        From address
        <input className="input" name="smtpFromEmail" type="email" defaultValue={text(smtp.fromEmail)} placeholder="noreply@example.com" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
        <input className="w-auto" type="checkbox" name="smtpSecure" defaultChecked={Boolean(smtp.secure)} /> Use a secure (TLS) connection
      </label>
      {testState ? (
        <div role="status" className={`rounded-2xl border p-3 text-sm font-semibold md:col-span-2 ${testState.ok ? "border-[#bfe8d6] bg-[#effaf5] text-[#0b6b4b]" : "border-[#f2c4c4] bg-[#fff5f5] text-[#a12a2a]"}`}>
          {testState.message}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <SubmitButton>Save email settings</SubmitButton>
        <button className="btn-secondary" formAction={testAction} disabled={isTesting}>
          {isTesting ? "Testing…" : "Test connection"}
        </button>
      </div>
    </form>
  );
}
