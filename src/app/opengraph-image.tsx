import { renderOgCard } from "@/lib/og-card";

export const alt = "EconoSim, an economics simulator: build an economy, shock it and see every step of the maths.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** og:image, rendered once at build time. */
export default function OpengraphImage() {
  return renderOgCard();
}
