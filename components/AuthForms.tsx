"use client";

import { useActionState } from "react";
import { loginAction, setupAction, type AuthFormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-[#fff1f1] p-3 text-sm font-semibold text-[var(--ui-danger)]">
      {message}
    </p>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(loginAction, null);
  return (
    <form action={action} className="panel grid gap-4">
      {notice && !state ? (
        <p role="status" className="rounded-xl bg-[#effaf5] p-3 text-sm font-semibold text-[#0b6b4b]">
          {notice}
        </p>
      ) : null}
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next || ""} />
      <label className="field">
        Email
        {/* React resets the form after each attempt; restore the email so it need not be retyped. */}
        <input key={state?.email} className="input" name="email" type="email" autoComplete="username" defaultValue={state?.email} required autoFocus={!state?.email} />
      </label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(state?.email) && !state?.needsTotp} />
      </label>
      {state?.needsTotp ? (
        <label className="field">
          Authentication code
          <input className="input tracking-widest" name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
          <span className="field-hint">Enter the 6-digit code from your authenticator app.</span>
        </label>
      ) : null}
      <SubmitButton className="btn-accent" pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-xs text-muted">Forgot your password? Run <code>npm run owner:reset-password</code> on the server (see README).</p>
    </form>
  );
}

type SetupFormDefaults = {
  displayName?: string;
  email?: string;
};

export function SetupForm({ defaults = {} }: { defaults?: SetupFormDefaults }) {
  const [state, action] = useActionState<AuthFormState, FormData>(setupAction, null);
  return (
    <form action={action} className="panel grid gap-4">
      <ErrorBox message={state?.error} />
      <label className="field">
        Your name
        <input key={`n-${state?.displayName}`} className="input" name="displayName" defaultValue={state?.displayName ?? defaults.displayName} autoComplete="name" required />
      </label>
      <label className="field">
        Email
        <input key={`e-${state?.email}`} className="input" name="email" type="email" defaultValue={state?.email ?? defaults.email} autoComplete="username" required />
      </label>
      <div className="field">
        <label htmlFor="setup-password">Password</label>
        <input id="setup-password" className="input" name="password" type="password" minLength={12} autoComplete="new-password" aria-describedby="setup-password-hint" required />
        <span id="setup-password-hint" className="field-hint">At least 12 characters. A passphrase works well.</span>
      </div>
      <label className="field">
        Confirm password
        <input className="input" name="confirmPassword" type="password" minLength={12} autoComplete="new-password" required />
      </label>
      <SubmitButton className="btn-accent" pendingLabel="Setting up…">Create my page</SubmitButton>
    </form>
  );
}
