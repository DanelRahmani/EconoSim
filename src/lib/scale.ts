/**
 * Axis domains for the charts.
 *
 * Kept out of the component rather than inlined, for one reason: the rule below
 * is checkable, and an axis that misstates its range is a wrong answer rather
 * than a cosmetic flaw. Everything a student reads off these charts is read off
 * an axis.
 */

/** Breathing room beyond the data at each end, as a fraction of the span. */
const DEFAULT_PAD = 0.08;

/**
 * A `[min, max]` range covering `values`, with a little room at both ends.
 *
 * Data that is entirely non-negative is never padded below zero. A quantity —
 * capital, output, units of a good — has no negative region, and drawing one puts
 * the origin off the left or bottom edge where the eye lands first: the
 * Cobb-Douglas chart was opening its x-axis at −63 because its data ran 1 to 800,
 * and the phase diagram likewise at −0.9.
 *
 * Two cases deliberately keep their old behaviour. Data that genuinely crosses
 * zero is padded both ways, since the sign change is the thing being shown. And a
 * range that starts well above zero keeps its zoom instead of being stretched
 * down to the origin, which would flatten an interest-rate axis to a straight line.
 *
 * A flat series is the third case, and the only one that can put a negative
 * figure on a quantity axis: a line that does not vary needs a window to be
 * visible at all, so it gets a symmetric one. That only bites when a whole panel
 * is flat — a flat series drawn *alongside* a varying one is clamped with the
 * rest, which is the usual shape (the AK model's dashed "No growth" baseline).
 */
export function axisDomain(values: number[], pad = DEFAULT_PAD): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];

  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    // A single value, or a flat series: it needs a window to sit in.
    lo -= 1;
    hi += 1;
  }

  const room = (hi - lo) * pad;
  return [lo >= 0 ? Math.max(0, lo - room) : lo - room, hi + room];
}
