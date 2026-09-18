import type { UseModelState } from "./useModel";

/**
 * The runtime's one-line status, in the panel's machine voice. It is the only
 * place that says whether the weights are on the device, so it never lies by
 * omission: "cached" means cached, "not cached" means a download is coming.
 */
export function modelStatusLabel(model: UseModelState): string {
  if (model.probing) return "Checking cache";
  if (model.status === "error") return "Runtime error";
  if (model.status === "running") return "Running inference";
  if (model.status === "ready") return "Weights cached";
  if (model.status === "loading") return model.cached ? "Restoring" : "Downloading weights";
  return model.cached ? "Weights cached" : "Weights not cached";
}

/**
 * Nothing is downloaded until the visitor asks for it, and the size is stated
 * before the first byte is fetched. Once the weights are cached the ask is
 * spent: the model comes back on its own and this button never reappears.
 */
export function ModelAction({
  model,
  sizeLabel,
}: {
  model: UseModelState;
  sizeLabel: string;
}) {
  if (model.probing || model.status === "loading") return null;
  if (model.status === "ready" || model.status === "running") return null;

  return (
    <button type="button" onClick={() => void model.load()} className="btn btn-primary">
      {model.cached ? "Start model" : `Download model (${sizeLabel})`}
    </button>
  );
}

/** The download meter, labelled on the left and counted off on the right. */
export function ModelProgress({
  model,
  sizeLabel,
}: {
  model: UseModelState;
  sizeLabel: string;
}) {
  if (model.status !== "loading") return null;

  const fromCache = model.cached;

  return (
    <div className="model-loader demo-shell-section">
      <div className="loader-row">
        <span className="eyebrow">
          {fromCache ? "Restoring binary weights" : "Loading binary weights"}
        </span>
        <span className="eyebrow">
          {fromCache ? "From cache" : `${model.progress}% / ${sizeLabel.replace(/^~/, "")}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={fromCache ? undefined : model.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={fromCache ? "Restoring model from cache" : "Model download progress"}
        className="meter"
      >
        <span
          className={fromCache ? "meter-fill meter-fill-indeterminate" : "meter-fill"}
          style={fromCache ? undefined : { width: `${model.progress}%` }}
        />
      </div>
    </div>
  );
}
