"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  const status = useFormStatus();
  return (
    <button className="btn" disabled={status.pending}>
      {status.pending ? "Saving..." : children}
    </button>
  );
}
