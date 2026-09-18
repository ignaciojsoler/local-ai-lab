/**
 * One predicted label: name on the left, a bar for the magnitude, the
 * probability itself on the right in tabular figures so a column of them
 * stays readable as a column.
 *
 * The bar is a magnitude encoding, so it takes a single hue stepped by rank
 * rather than a colour per category — identity is carried by the label, and
 * the reader can tell the leader from the tail at a glance.
 */
export function ConfidenceBar({
  label,
  score,
  rank = 0,
}: {
  label: string;
  score: number;
  rank?: number;
}) {
  return (
    <div className="score-row" data-rank={rank}>
      <span className="score-label">{label}</span>
      <span className="meter">
        <span className="meter-fill" style={{ width: `${score * 100}%` }} />
      </span>
      <span className="score-value">{score.toFixed(2)}</span>
    </div>
  );
}
