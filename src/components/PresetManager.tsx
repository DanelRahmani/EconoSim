"use client";

import { useState, useSyncExternalStore } from "react";
import type { Economy } from "@/lib/econ/types";
import { presetStore } from "@/lib/presets-store";

/** Save the current economy to the browser, and reload saved ones later. */
export function PresetManager({ current, onLoad }: { current: Economy; onLoad: (e: Economy) => void }) {
  const saved = useSyncExternalStore(presetStore.subscribe, presetStore.get, presetStore.getServer);
  const [name, setName] = useState("");

  const save = () => {
    presetStore.save(name || current.name, current);
    setName("");
  };

  return (
    <div className="card reveal p-4" style={{ animationDelay: "60ms" }}>
      <h2 className="mb-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted">My presets</h2>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={current.name}
          aria-label="Preset name"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface2 px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          title="Save the current economy in this browser"
          className="shrink-0 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
        >
          Save
        </button>
      </div>

      {saved.length === 0 ? (
        <p className="mt-2.5 text-[0.6875rem] leading-snug text-muted/80">
          Saved in your browser only. Nothing is uploaded.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-1">
          {saved.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onLoad(p.economy)}
                title="Load this preset"
                className="min-w-0 flex-1 truncate rounded-lg border border-hairline px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:border-accent/50 hover:text-accent"
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => presetStore.remove(p.id)}
                aria-label={`Delete ${p.name}`}
                title="Delete"
                className="shrink-0 rounded-lg border border-hairline px-2 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-accent"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
