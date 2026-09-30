"use client";

import { useEffect, useRef } from "react";

const PREFIX = "belinked:form:";

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  // Use the prototype setter so React-controlled inputs see the change via onChange.
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

/**
 * Place inside a <form>. On submit it snapshots the fields to sessionStorage; if the
 * server action redirects back with ?error=, the snapshot is restored so a validation
 * error never throws away the owner's other edits. Passwords and files are never stored.
 */
export function FormRestore({ id }: { id: string }) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    const key = PREFIX + id;
    const params = new URLSearchParams(location.search);

    try {
      const saved = sessionStorage.getItem(key);
      if (saved && params.has("error")) {
        const values = JSON.parse(saved) as Record<string, string | boolean>;
        for (const element of Array.from(form.elements)) {
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) continue;
          const storedKey = element instanceof HTMLInputElement && element.type === "radio" ? `${element.name}=${element.value}` : element.name;
          if (!(storedKey in values)) continue;
          if (element instanceof HTMLInputElement && element.type === "checkbox") {
            const value = values[element.name];
            if (typeof value === "boolean" && element.checked !== value) element.click();
          } else if (element instanceof HTMLInputElement && element.type === "radio") {
            if (values[`${element.name}=${element.value}`] === true && !element.checked) element.click();
          } else if (!(element instanceof HTMLInputElement && ["file", "password", "hidden"].includes(element.type))) {
            setNativeValue(element, String(values[element.name]));
          }
        }
      }
      if (!params.has("error")) sessionStorage.removeItem(key);
    } catch {
      // Storage unavailable (private mode etc.): nothing to restore.
    }

    function snapshot() {
      if (!form) return;
      const values: Record<string, string | boolean> = {};
      for (const element of Array.from(form.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) continue;
        if (element instanceof HTMLInputElement) {
          if (["file", "password"].includes(element.type)) continue;
          if (element.type === "checkbox") values[element.name] = element.checked;
          else if (element.type === "radio") values[`${element.name}=${element.value}`] = element.checked;
          else values[element.name] = element.value;
        } else {
          values[element.name] = element.value;
        }
      }
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        // ignore
      }
    }
    form.addEventListener("submit", snapshot);
    return () => form.removeEventListener("submit", snapshot);
  }, [id]);

  return <span ref={marker} hidden />;
}
