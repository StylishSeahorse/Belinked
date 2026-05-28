"use client";

import { useActionState } from "react";
import { loginAction, setupAction } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="panel grid gap-4">
      {state?.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      <label className="field">
        Email
        <input className="input" name="email" type="email" required />
      </label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" required />
      </label>
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function SetupForm() {
  const [, action] = useActionState(setupAction, null);
  return (
    <form action={action} className="panel grid gap-4">
      <label className="field">
        Display name
        <input className="input" name="displayName" required />
      </label>
      <label className="field">
        Email
        <input className="input" name="email" type="email" required />
      </label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" minLength={12} required />
      </label>
      <SubmitButton>Create owner</SubmitButton>
    </form>
  );
}
