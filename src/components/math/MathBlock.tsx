"use client";

import { useMemo } from "react";
import katex from "katex";

/** Renders a LaTeX string with KaTeX (outputs MathML too, so it reads aloud). */
export function MathBlock({ latex, block = false }: { latex: string; block?: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: block,
        output: "htmlAndMathml",
      }),
    [latex, block],
  );
  return <span className={block ? "block my-1 overflow-x-auto" : "inline-block"} dangerouslySetInnerHTML={{ __html: html }} />;
}
