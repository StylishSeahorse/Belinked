"use client";

import { AlertTriangle, Check, CheckCircle2, Loader2, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info"; action?: { label: string; onClick: () => void } };
type SaveState = "idle" | "saving" | "saved" | "error";

type FeedbackContext = {
  toast: (message: string, options?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
  /** Wrap any save; drives the global "Saving… / Saved" indicator. */
  track: <T>(promise: Promise<T>) => Promise<T>;
  saveState: SaveState;
};

const Context = createContext<FeedbackContext | null>(null);

export function useFeedback() {
  const context = useContext(Context);
  if (!context) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return context;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const nextId = useRef(1);

  const toast = useCallback<FeedbackContext["toast"]>((message, options = {}) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone: options.tone || "success", action: options.action }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), options.action ? 6000 : 3200);
  }, []);

  const track = useCallback(<T,>(promise: Promise<T>) => {
    setPending((count) => count + 1);
    setSaveState("saving");
    return promise
      .then((result) => {
        const failed = result && typeof result === "object" && "ok" in result && (result as { ok: boolean }).ok === false;
        setSaveState(failed ? "error" : "saved");
        return result;
      })
      .catch((error) => {
        setSaveState("error");
        throw error;
      })
      .finally(() => setPending((count) => count - 1));
  }, []);

  // Never silently lose work: warn before leaving while a save is in flight.
  useEffect(() => {
    if (!pending) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pending]);

  const value = useMemo(() => ({ toast, track, saveState: pending ? "saving" : saveState }), [toast, track, pending, saveState]);

  return (
    <Context.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className="ui-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-[#16161d] py-2.5 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl"
          >
            {item.tone === "error" ? <AlertTriangle size={16} className="shrink-0 text-red-300" aria-hidden="true" /> : <CheckCircle2 size={16} className="shrink-0 text-emerald-300" aria-hidden="true" />}
            <span className="min-w-0">{item.message}</span>
            {item.action ? (
              <button
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
                onClick={() => {
                  item.action?.onClick();
                  setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id));
                }}
              >
                {item.action.label}
              </button>
            ) : null}
            <button className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15" aria-label="Dismiss" onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function SaveIndicator() {
  const { saveState } = useFeedback();
  if (saveState === "idle") return null;
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      {saveState === "saving" ? (
        <>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…
        </>
      ) : saveState === "error" ? (
        <span className="inline-flex items-center gap-1.5 text-[var(--ui-danger)]">
          <AlertTriangle size={14} aria-hidden="true" /> Not saved
        </span>
      ) : (
        <>
          <Check size={14} className="text-[var(--ui-success)]" aria-hidden="true" /> Saved
        </>
      )}
    </span>
  );
}
