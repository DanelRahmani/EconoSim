"use client";

import { useState } from "react";

/**
 * Copies a shareable link to the current simulator state and keeps the address
 * bar in step, so a refresh comes back to the same view.
 *
 * The URL is built on click rather than during render: it needs the browser's
 * origin, which does not exist on the server.
 */
export function ShareLink({ build }: { build: () => string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = () => {
    if (url) {
      setUrl(null);
      return;
    }
    const next = build();
    setUrl(next);
    setCopied(false);
    // Keep the address bar in sync so a plain refresh reproduces the view.
    window.history.replaceState(null, "", next);
    const written = navigator.clipboard?.writeText(next);
    if (written) void written.then(() => setCopied(true), () => setCopied(false));
  };

  const copy = () => {
    if (!url) return;
    const written = navigator.clipboard?.writeText(url);
    if (written) void written.then(() => setCopied(true), () => setCopied(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-expanded={url !== null}
        title="Get a link that reopens this exact economy, model and set of shocks"
        className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
      >
        Share
      </button>

      {url && (
        <div className="flex basis-full flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface2/60 px-3 py-2">
          <label htmlFor="share-url" className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
            Link
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-full border border-hairline px-2.5 py-0.5 text-xs transition-colors hover:border-accent/50 hover:text-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="basis-full text-[0.6875rem] leading-snug text-muted">
            Everything is encoded in the link — no account, no server. Anyone opening it sees this economy, model,
            window and shocks.
          </span>
        </div>
      )}
    </>
  );
}
