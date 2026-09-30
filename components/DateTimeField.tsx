"use client";

import { useEffect, useState } from "react";

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * datetime-local input shown in the browser's timezone. It submits an ISO timestamp
 * in a hidden field, so the server never has to guess the owner's timezone.
 */
export function DateTimeField({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string | null; hint?: string }) {
  const [local, setLocal] = useState("");
  useEffect(() => setLocal(toLocalInput(defaultValue)), [defaultValue]);
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <label className="field">
      {label}
      <input className="input" type="datetime-local" value={local} onChange={(event) => setLocal(event.target.value)} />
      <input type="hidden" name={name} value={iso} />
      {hint ? <span className="text-xs text-black/55">{hint}</span> : null}
    </label>
  );
}
