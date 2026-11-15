/**
 * The EconoSim wordmark, set like the name on danelrahmani.com: Bodoni Moda italic
 * with a basting stitch sewn in underneath on load.
 */
export function Wordmark({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className="inline-flex flex-col">
      <span
        className={`font-display italic leading-none tracking-[-0.02em] text-ink ${
          size === "md" ? "text-[1.625rem]" : "text-[1.375rem]"
        }`}
      >
        EconoSim
      </span>
      <span aria-hidden className="stitch-under mt-1" />
    </span>
  );
}
