import { ImageResponse } from "next/og";
import { SITE_DOMAIN } from "@/lib/site";

/**
 * The link-preview card (1200×630), shared by opengraph-image and twitter-image.
 * Drawn in the dark theme's tokens with the header's Σ mark. Sizes are chosen to
 * survive being shown ~400px wide (a third of full size): nothing below 30px.
 */

const BG = "#07080b";
const SURFACE = "#0d0f14";
const INK = "#f4f6f9";
const MUTED = "#98a1b0";
const ROSE = "#ff4d6d";
const TEAL = "#2fe0a0";

const TITLE = "An economy you can build, shock and understand.";
const TAGLINE = "Live economics models, with every step of the maths shown.";
const TEXT = `EconoSim${TITLE}${TAGLINE}${SITE_DOMAIN}`;

/**
 * Geist, the site's typeface, in one weight. ImageResponse bundles only Geist
 * Regular, and once any custom font is passed it falls back glyph by glyph, so
 * both weights are fetched from Google Fonts, subset to the characters on the
 * card. Cached, so the image routes render once at build rather than per request.
 * If either fetch fails the card still renders, in the bundled regular weight.
 */
async function geist(weight: 400 | 700): Promise<ArrayBuffer | null> {
  "use cache";
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}&text=${encodeURIComponent(TEXT)}`)
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
  const [regular, bold] = await Promise.all([geist(400), geist(700)]);
  const fonts =
    regular && bold
      ? [
          { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
          { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
        ]
      : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          backgroundImage:
            "radial-gradient(circle at 10% 0%, rgba(255,77,109,0.30), transparent 45%), radial-gradient(circle at 96% 8%, rgba(47,224,160,0.18), transparent 40%)",
          color: INK,
          padding: "60px 72px 52px",
          fontFamily: "Geist",
          fontWeight: 400,
        }}
      >
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <svg width="72" height="72" viewBox="0 0 32 32">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#e11d48" />
                    <stop offset="1" stopColor="#b0485a" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="url(#g)" />
                <path
                  d="M22.5 10.5V8.5H9.5L16.5 16L9.5 23.5H22.5V21.5"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3.2"
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                />
              </svg>
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>EconoSim</div>
            </div>
            <div style={{ marginTop: 48, fontSize: 74, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5 }}>
              {TITLE}
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", paddingTop: 30 }}>
            <svg width="320" height="320" viewBox="0 0 400 400">
              <rect x="10" y="10" width="380" height="380" rx="28" fill={SURFACE} stroke="rgba(244,246,249,0.12)" />
              <line x1="70" y1="330" x2="350" y2="330" stroke={MUTED} strokeWidth="3" />
              <line x1="70" y1="330" x2="70" y2="60" stroke={MUTED} strokeWidth="3" />
              {/* LM rising; IS before (dashed) and after a fiscal expansion */}
              <line x1="90" y1="310" x2="340" y2="80" stroke={TEAL} strokeWidth="8" strokeLinecap="round" />
              <line x1="80" y1="110" x2="290" y2="320" stroke={ROSE} strokeOpacity="0.55" strokeWidth="7" strokeDasharray="16 13" />
              <line x1="140" y1="80" x2="350" y2="290" stroke={ROSE} strokeWidth="8" strokeLinecap="round" />
              <circle cx="189" cy="219" r="11" fill={INK} fillOpacity="0.6" />
              <circle cx="236" cy="176" r="14" fill={ROSE} stroke={SURFACE} strokeWidth="4" />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{TAGLINE}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, fontSize: 30, color: ROSE }}>
          {SITE_DOMAIN}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
