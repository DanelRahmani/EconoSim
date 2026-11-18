/**
 * Names of chart lines in a comparison. The engine tags a moved curve "IS (new)"
 * or "IS (shock)" and its baseline twin "IS (base)"; the charts show the name
 * and the tag separately, so the tag can be set smaller and quieter.
 */

const TAG = / \((shock|new|base)\)$/;

/** "SRAS (base)" → { name: "SRAS", tag: "base" }. */
export function splitTag(label: string): { name: string; tag: string | null } {
  const m = label.match(TAG);
  return m ? { name: label.slice(0, m.index), tag: m[1] } : { name: label, tag: null };
}

/**
 * Identity of a series or marker across comparison modes. "IS" becomes "IS (new)"
 * when the comparison switches on; it is the same curve, so it keeps its React key
 * and is never redrawn from nothing. A baseline ghost is a different thing and
 * gets its own identity (so it can fade in on its own).
 */
export function stableId(label: string, ghost?: boolean): string {
  return `${ghost ? "ghost:" : ""}${splitTag(label).name}`;
}
