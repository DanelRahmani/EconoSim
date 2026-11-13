import { renderOgCard } from "@/lib/og-card";

// Route config must be literal in each file for Next to read it statically.
export const alt = "EconoSim, an economics simulator: build an economy, shock it and see every step of the maths.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** twitter:image: the same card as og:image. */
export default function TwitterImage() {
  return renderOgCard();
}
