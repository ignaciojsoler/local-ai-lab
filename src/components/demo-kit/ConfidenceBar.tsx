/** A verdict's polarity, for the one task whose labels are not categories. */
export type Tone = "positive" | "negative";

/**
 * One predicted label: name on the left, a bar for the magnitude, the
 * probability itself on the right in tabular figures so a column of them
 * stays readable as a column.
 *
 * The bar is a magnitude encoding, so it takes a single hue stepped by rank
 * rather than a colour per category — identity is carried by the label, and
 * the reader can tell the leader from the tail at a glance.
 *
 * `tone` is the exception, for sentiment: there the label is a polarity, and
 * a NEGATIVE at 0.99 is the other answer rather than a high score. The colour
 * is redundant with the label beside it, never the only thing carrying it.
 */
export function ConfidenceBar({
  label,
  score,
  rank = 0,
  tone,
}: {
  label: string;
  score: number;
  rank?: number;
  tone?: Tone;
}) {
  return (
    <div className="score-row" data-rank={rank} data-tone={tone}>
      <span className="score-label">{label}</span>
      <span className="meter">
        <span className="meter-fill" style={{ width: `${score * 100}%` }} />
      </span>
      <span className="score-value">{score.toFixed(2)}</span>
    </div>
  );
}
