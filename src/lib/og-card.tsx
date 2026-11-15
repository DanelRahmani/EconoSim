import { ImageResponse } from "next/og";
import { SITE_DOMAIN } from "@/lib/site";

/**
 * The link-preview card (1200×630), shared by opengraph-image and twitter-image.
 * Drawn in the light theme of the danelrahmani.com system: creme cloth, maroon
 * thread, the name in Bodoni Moda italic. Sizes are chosen to survive being shown
 * ~400px wide (a third of full size): nothing below 30px.
 */

const BG = "#fdfbf6";
const PANEL = "#faf6ed";
const INK = "#1c1917";
const MUTED = "#57534e";
const ACCENT = "#4a0e0e";
const SEAM = "rgba(74,14,14,0.3)";

const TITLE = "An economy you can build, shock and understand.";
const TAGLINE = "Live economics models, with every step of the maths shown.";
const TEXT = `EconoSim${TITLE}${TAGLINE}${SITE_DOMAIN}`;

/**
 * One face from Google Fonts, subset to the characters on the card. ImageResponse
 * bundles only Geist Regular, so anything else must be fetched. Cached, so the image
 * routes render once at build rather than per request. A failed fetch returns null
 * and the card falls back to the bundled face.
 */
async function googleFont(family: string, axes: string): Promise<ArrayBuffer | null> {
  "use cache";
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axes}&text=${encodeURIComponent(TEXT)}`)
    ).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function renderOgCard(): Promise<ImageResponse> {
  const [geist, bodoni] = await Promise.all([
    googleFont("Geist", "wght@400"),
    googleFont("Bodoni+Moda", "ital,wght@1,400"),
  ]);
  const fonts = [
    ...(geist ? [{ name: "Geist", data: geist, weight: 400 as const, style: "normal" as const }] : []),
    ...(bodoni ? [{ name: "Bodoni Moda", data: bodoni, weight: 400 as const, style: "italic" as const }] : []),
  ];
  const display = bodoni ? "Bodoni Moda" : "Geist";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          backgroundImage: "radial-gradient(circle at 12% 0%, rgba(74,14,14,0.07), transparent 50%)",
          color: INK,
          padding: "60px 72px 52px",
          fontFamily: "Geist",
          fontWeight: 400,
        }}
      >
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
            <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
              <div style={{ fontFamily: display, fontStyle: "italic", fontSize: 54, lineHeight: 1, letterSpacing: -1 }}>
                EconoSim
              </div>
              <svg width="230" height="6" viewBox="0 0 230 6" style={{ marginTop: 10 }}>
                <line x1="1" y1="3" x2="229" y2="3" stroke={ACCENT} strokeWidth="3" strokeDasharray="18 14" strokeLinecap="round" />
              </svg>
            </div>
            <div
              style={{
                marginTop: 44,
                fontFamily: display,
                fontStyle: "italic",
                fontSize: 76,
                lineHeight: 1.06,
                letterSpacing: -1.5,
              }}
            >
              {TITLE}
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", paddingTop: 30 }}>
            <svg width="320" height="320" viewBox="0 0 400 400">
              <rect x="10" y="10" width="380" height="380" rx="32" fill={PANEL} stroke="rgba(74,14,14,0.12)" />
              <line x1="70" y1="330" x2="350" y2="330" stroke={MUTED} strokeWidth="3" />
              <line x1="70" y1="330" x2="70" y2="60" stroke={MUTED} strokeWidth="3" />
              {/* LM rising; IS before (dashed) and after a fiscal expansion */}
              <line x1="90" y1="310" x2="340" y2="80" stroke={INK} strokeWidth="7" strokeLinecap="round" />
              <line x1="80" y1="110" x2="290" y2="320" stroke={SEAM} strokeWidth="6" strokeDasharray="18 14" strokeLinecap="round" />
              <line x1="140" y1="80" x2="350" y2="290" stroke={ACCENT} strokeWidth="8" strokeLinecap="round" />
              <circle cx="189" cy="219" r="10" fill={MUTED} />
              <circle cx="236" cy="176" r="14" fill={ACCENT} stroke={PANEL} strokeWidth="4" />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{TAGLINE}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, fontSize: 30, color: ACCENT }}>
          {SITE_DOMAIN}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined },
  );
}
