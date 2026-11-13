import type { Metadata } from "next";
import { Simulator } from "@/components/Simulator";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

// openGraph is replaced, not merged, by a child segment, so it is restated in full
// with this page's own URL. The image files at the app root still apply.
export const metadata: Metadata = {
  alternates: { canonical: "/simulator" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/simulator",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function SimulatorPage() {
  return <Simulator />;
}
