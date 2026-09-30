"use client";

import { useEffect } from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** Sends one privacy-friendly page-view beacon. The only client JS on the public page. */
export function ViewBeacon() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payload: Record<string, string> = { path: location.pathname, referrer: document.referrer };
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) payload[key] = value.slice(0, 80);
    }
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" }))) {
      void fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => undefined);
    }
  }, []);
  return null;
}
