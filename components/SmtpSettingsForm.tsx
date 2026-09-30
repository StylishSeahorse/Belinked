"use client";

import { FormRestore } from "@/components/FormRestore";

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
  const meta = (platform.meta || {}) as Record<string, unknown>;

  return (
    <form action={saveSettingsAction} className="panel grid gap-4 md:grid-cols-2">
      <FormRestore id="settings" />
      <h2 className="text-xl font-black md:col-span-2">General</h2>
      <label className="field">
        Platform name
        <input className="input" name="name" defaultValue={text(platform.name, "Belinked")} />
      </label>
      <label className="field">
        Footer text
        <input className="input" name="footerText" defaultValue={text(platform.footerText)} maxLength={200} />
        <span className="text-xs text-white/55">Shown at the bottom of your public page. Leave empty to hide.</span>
      </label>
      <h2 className="border-t border-white/10 pt-4 text-xl font-black md:col-span-2">Email (SMTP)</h2>
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
        <input className="input" name="smtpPassword" type="password" placeholder={smtp.password ? "Saved; leave blank to keep" : ""} autoComplete="new-password" />
        {smtp.password ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/60">
            <input className="w-auto" type="checkbox" name="clearSmtpPassword" /> Clear saved password
          </span>
        ) : null}
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
      <div className="grid gap-4 border-t border-white/10 pt-4 md:col-span-2 md:grid-cols-2">
        <h2 className="text-xl font-black md:col-span-2">Meta integrations</h2>
        <label className="flex items-center gap-2 text-sm font-semibold text-white/80 md:col-span-2">
          <input className="w-auto" type="checkbox" name="metaEnabled" defaultChecked={Boolean(meta.enabled)} /> Show Instagram and Facebook stats
        </label>
        <label className="field">
          Graph API version
          <input className="input" name="metaGraphVersion" defaultValue={text(meta.graphVersion, "v23.0")} placeholder="v23.0" />
        </label>
        <label className="field">
          Instagram user ID
          <input className="input" name="metaInstagramUserId" defaultValue={text(meta.instagramUserId)} placeholder="17841400000000000" />
        </label>
        <label className="field">
          Instagram access token
          <input
            className="input"
            name="metaInstagramAccessToken"
            type="password"
            placeholder={meta.instagramAccessToken ? "Saved; leave blank to keep" : "Page or IG Graph token"}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Facebook page ID
          <input className="input" name="metaFacebookPageId" defaultValue={text(meta.facebookPageId)} placeholder="1234567890" />
        </label>
        <label className="field">
          Facebook page access token
          <input
            className="input"
            name="metaFacebookAccessToken"
            type="password"
            placeholder={meta.facebookAccessToken ? "Saved; leave blank to keep" : "Page access token"}
            autoComplete="off"
          />
        </label>
        {meta.instagramAccessToken || meta.facebookAccessToken ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-white/60 md:col-span-2">
            <input className="w-auto" type="checkbox" name="clearMetaTokens" /> Clear saved access tokens
          </label>
        ) : null}
        <p className="text-sm text-white/55 md:col-span-2">
          Results are cached for 15 minutes so your page stays fast. Instagram follower counts require an Instagram Business or Creator account and Graph API access. Facebook follower counts require Page access.
        </p>
      </div>
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
