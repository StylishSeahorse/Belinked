"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children = "Save", className = "btn", pendingLabel = "Saving..." }: { children?: React.ReactNode; className?: string; pendingLabel?: string }) {
  const status = useFormStatus();
  return (
    <button className={className} disabled={status.pending} aria-busy={status.pending}>
      {status.pending ? pendingLabel : children}
    </button>
  );
}
