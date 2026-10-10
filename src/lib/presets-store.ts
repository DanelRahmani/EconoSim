import type { Economy } from "@/lib/econ/types";

/** User-saved economies, kept in localStorage. */

export interface SavedPreset {
  id: string;
  name: string;
  economy: Economy;
  savedAt: number;
}

const STORAGE_KEY = "econosim-presets";
const EMPTY: SavedPreset[] = [];
const listeners = new Set<() => void>();

let presets: SavedPreset[] = EMPTY;

function read(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (p): p is SavedPreset =>
        typeof p === "object" && p !== null && typeof (p as SavedPreset).name === "string" && typeof (p as SavedPreset).economy === "object",
    );
  } catch {
    return EMPTY;
  }
}

function write(next: SavedPreset[]): void {
  presets = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — keep the in-memory list */
  }
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  presets = read();
}

export const presetStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): SavedPreset[] {
    return presets;
  },
  getServer(): SavedPreset[] {
    return EMPTY;
  },
  save(name: string, economy: Economy): void {
    const trimmed = name.trim() || "Untitled";
    const next = [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: trimmed, economy: { ...economy, name: trimmed }, savedAt: Date.now() },
      ...presets,
    ].slice(0, 40);
    write(next);
  },
  remove(id: string): void {
    write(presets.filter((p) => p.id !== id));
  },
};
