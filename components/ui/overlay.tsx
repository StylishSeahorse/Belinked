"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Modal dialog built on native <dialog> (focus trap, Escape, top layer for free).
 * variant "drawer" slides in from the right on desktop; everything becomes a bottom
 * sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
  size = "md"
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "drawer";
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = size === "lg" ? "md:max-w-2xl" : "md:max-w-lg";
  const placement =
    variant === "drawer"
      ? "md:ml-auto md:mr-0 md:h-full md:max-h-full md:w-[460px] md:max-w-[460px] md:rounded-none md:rounded-l-3xl"
      : `md:m-auto md:h-fit md:max-h-[85vh] md:w-full ${width} md:rounded-3xl`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Backdrop click closes.
        if (event.target === ref.current) onClose();
      }}
      className={`${variant === "drawer" ? "ui-slide-in" : "ui-sheet-up"} fixed inset-x-0 bottom-0 top-auto m-0 mt-auto max-h-[92vh] w-full max-w-full overflow-hidden rounded-t-3xl bg-white p-0 text-[var(--ui-ink)] shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] md:inset-0 ${placement}`}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div className="flex max-h-[92vh] flex-col md:max-h-[inherit] md:h-full">
          <header className="flex items-start gap-3 border-b border-[var(--ui-border)] px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="dialog-title" className="text-lg font-black">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--ui-border)] px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Simple dropdown menu (the "⋮ More" pattern). */
export function Menu({ label, trigger, children, align = "right", triggerClassName = "icon-btn" }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') || []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        next?.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" className={triggerClassName} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {trigger}
      </button>
      {open ? (
        <div role="menu" aria-label={label} className={`ui-pop absolute z-40 mt-1 min-w-52 overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-white p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ icon, children, onSelect, danger = false }: { icon?: ReactNode; children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold outline-none hover:bg-[#f3f3f1] focus:bg-[#f3f3f1] ${danger ? "text-[var(--ui-danger)]" : ""}`}
    >
      <span className="grid w-4 place-items-center" aria-hidden="true">
        {icon}
      </span>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} className="toggle disabled:opacity-50" onClick={() => onChange(!checked)} />;
}
