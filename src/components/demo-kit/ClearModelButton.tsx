import { useState } from "react";
import { formatBytes } from "../../lib/model-cache";

/**
 * Deleting downloaded weights is destructive enough to confirm, and small
 * enough that a modal would be heavier than the action. The button becomes
 * its own confirmation in place.
 */
export function ClearModelButton({
  cacheSize,
  onClear,
}: {
  cacheSize: number | null;
  onClear(): Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const size = cacheSize === null ? null : formatBytes(cacheSize);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="link-quiet"
        title="Delete the downloaded weights from this browser"
      >
        Clear model{size ? ` (${size})` : ""}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs text-[var(--color-muted)]">
        Delete {size ?? "the"} weights from this browser?
      </span>
      <button
        type="button"
        disabled={clearing}
        onClick={async () => {
          setClearing(true);
          try {
            await onClear();
          } finally {
            setClearing(false);
            setConfirming(false);
          }
        }}
        className="chip"
      >
        {clearing ? "Clearing…" : "Clear"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="chip">
        Cancel
      </button>
    </span>
  );
}
