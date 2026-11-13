import { ImageResponse } from "next/og";

export const alt = "EconoSim: an economics simulator. An IS-LM diagram with the IS curve shifting right.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROSE = "#ff4d6d";
const TEAL = "#2fe0a0";

/** The share card, rendered once at build time in the dark theme's colours. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#07080b",
          backgroundImage: `radial-gradient(circle at 12% 0%, rgba(255,77,109,0.28), transparent 45%), radial-gradient(circle at 95% 10%, rgba(47,224,160,0.18), transparent 40%)`,
          color: "#f4f6f9",
          padding: "64px 72px",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 32 32">
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
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>EconoSim</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, letterSpacing: 5, textTransform: "uppercase", color: ROSE }}>
              Economics simulator
            </div>
            <div style={{ marginTop: 18, fontSize: 64, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>
              An economy you can build, shock and understand.
            </div>
          </div>

          <div style={{ fontSize: 24, color: "#98a1b0" }}>
            21 models · live curves · every step of the maths
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <svg width="400" height="400" viewBox="0 0 400 400">
            <rect x="20" y="20" width="360" height="360" rx="24" fill="#0d0f14" stroke="rgba(244,246,249,0.1)" />
            <line x1="70" y1="330" x2="350" y2="330" stroke="#98a1b0" strokeWidth="2" />
            <line x1="70" y1="330" x2="70" y2="60" stroke="#98a1b0" strokeWidth="2" />
            {/* LM rising, IS before (dashed) and after the fiscal expansion */}
            <line x1="90" y1="310" x2="340" y2="80" stroke={TEAL} strokeWidth="6" strokeLinecap="round" />
            <line x1="80" y1="110" x2="290" y2="320" stroke={ROSE} strokeOpacity="0.55" strokeWidth="5" strokeDasharray="14 12" />
            <line x1="140" y1="80" x2="350" y2="290" stroke={ROSE} strokeWidth="6" strokeLinecap="round" />
            <circle cx="189" cy="219" r="9" fill="#f4f6f9" fillOpacity="0.6" />
            <circle cx="236" cy="176" r="11" fill={ROSE} stroke="#0d0f14" strokeWidth="3" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
