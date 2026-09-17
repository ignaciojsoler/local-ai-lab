import type { ModelStatus } from "./useModel";

/**
 * Nothing is downloaded until the visitor asks for it, and the size is stated
 * before the first byte is fetched.
 */
export function ModelLoader({
  status,
  progress,
  sizeLabel,
  onLoad,
}: {
  status: ModelStatus;
  progress: number;
  sizeLabel: string;
  onLoad(): void;
}) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Model download progress"
          className="meter"
        >
          <span className="meter-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-mono text-xs text-[var(--color-muted)]">
          Downloading model… {progress}%
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={onLoad} className="btn btn-primary w-fit">
        Load model ({sizeLabel})
      </button>
      <p className="text-xs text-[var(--color-muted)]">
        Runs entirely in your browser. Cached after the first download.
      </p>
    </div>
  );
}
