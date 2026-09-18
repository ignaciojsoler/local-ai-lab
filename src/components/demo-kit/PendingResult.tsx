/**
 * What the results column says before there are results.
 *
 * Inference is not instant — detection takes seconds on a CPU — so the idle
 * copy has to give way to something that is visibly working. Otherwise the
 * panel looks like it ignored the click for as long as the model runs.
 */
export function PendingResult({
  running,
  label = "Running the model",
}: {
  running: boolean;
  label?: string;
}) {
  if (!running) return <p className="eyebrow">No run yet</p>;

  return (
    <div className="model-loader" aria-live="polite">
      <div
        role="progressbar"
        aria-label="Running inference"
        className="meter"
      >
        <span className="meter-fill meter-fill-indeterminate" />
      </div>
      <p className="eyebrow">{label}…</p>
    </div>
  );
}
