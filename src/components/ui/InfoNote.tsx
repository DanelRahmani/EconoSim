"use client";

import { useState } from "react";

/**
 * A click-to-open explanation.
 *
 * The trigger sits inline with its label, while the panel drops onto its own row
 * in normal flow (`order-last w-full`) — so it is never clipped by a scrolling
 * sidebar the way an absolutely-positioned tooltip would be. `display: contents`
 * lets the button and panel participate in the parent's flex layout without an
 * extra wrapper box changing the row's alignment.
 */
export function InfoNote({ help, label }: { help: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label ? `Explain ${label}` : "Explain"}
        className={`ml-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.5625rem] font-sans font-bold not-italic leading-none transition-colors ${
          open
            ? "border-accent bg-accent text-accentink"
            : "border-hairline text-muted hover:border-accent/60 hover:text-accent"
        }`}
      >
        i
      </button>
      {open && (
        <span className="order-last mt-1.5 w-full rounded-lg border border-hairline bg-surface2/70 px-2.5 py-2 font-sans text-[0.6875rem] font-normal normal-case leading-relaxed tracking-normal text-muted">
          {help}
        </span>
      )}
    </span>
  );
}
