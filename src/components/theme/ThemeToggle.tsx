"use client";

import { type Theme, useTheme } from "./ThemeProvider";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "Match system",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    ),
  },
];

/** Three-way theme switch with a sliding indicator. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="relative inline-grid rounded-full border border-hairline bg-surface2 p-0.5"
      style={{ gridTemplateColumns: `repeat(${OPTIONS.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 rounded-full bg-accent transition-[left] duration-300 ease-out"
        style={{ width: `calc((100% - 4px) / ${OPTIONS.length})`, left: `calc(2px + (100% - 4px) / ${OPTIONS.length} * ${index})` }}
      />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={`relative z-10 flex items-center justify-center rounded-full px-2.5 py-1.5 transition-colors duration-200 ${
            theme === o.value ? "text-accentink" : "text-muted hover:text-ink"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
