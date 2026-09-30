"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFeedback } from "@/components/ui/feedback";

type Entry = { timer: ReturnType<typeof setTimeout> | null; run: () => Promise<unknown>; resolve: (value: unknown) => void };

/**
 * Debounced autosave keyed by field/record. "Saving…" shows as soon as a change is
 * queued (not only when the request starts) and leaving the page is guarded until
 * every queued change has been written.
 */
export function useAutosave(delay = 650) {
  const { track } = useFeedback();
  const entries = useRef(new Map<string, Entry>());

  const flush = useCallback(async (key: string) => {
    const entry = entries.current.get(key);
    if (!entry) return;
    entries.current.delete(key);
    if (entry.timer) clearTimeout(entry.timer);
    try {
      entry.resolve(await entry.run());
    } catch (error) {
      entry.resolve({ ok: false, error: error instanceof Error ? error.message : "Save failed" });
    }
  }, []);

  const schedule = useCallback(
    (key: string, run: () => Promise<unknown>, wait = delay) => {
      let entry = entries.current.get(key);
      if (!entry) {
        let resolve: (value: unknown) => void = () => undefined;
        const promise = new Promise((done) => {
          resolve = done;
        });
        entry = { timer: null, run, resolve };
        entries.current.set(key, entry);
        void track(promise);
      }
      entry.run = run;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void flush(key), wait);
    },
    [delay, flush, track]
  );

  const flushAll = useCallback(() => Promise.all([...entries.current.keys()].map((key) => flush(key))), [flush]);

  // Flush anything queued when leaving the screen inside the app.
  useEffect(() => () => void flushAll(), [flushAll]);

  return { schedule, flush, flushAll };
}
