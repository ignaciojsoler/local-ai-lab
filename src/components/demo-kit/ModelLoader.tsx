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
          className="h-1 w-full overflow-hidden rounded bg-current/10"
        >
          <div className="h-full bg-current transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-mono text-xs opacity-70">Downloading model… {progress}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="w-fit rounded border border-current/30 px-3 py-2 font-mono text-sm hover:bg-current/5"
      >
        Load model ({sizeLabel})
      </button>
      <p className="text-xs opacity-60">
        Runs entirely in your browser. Cached after the first download.
      </p>
    </div>
  );
}
