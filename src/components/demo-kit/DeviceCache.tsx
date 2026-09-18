import { useCallback, useEffect, useState } from "react";
import { cachedModelSize, clearModelCache, formatBytes } from "../../lib/model-cache";

type CacheState = {
  probing: boolean;
  cached: number;
  bytes: number;
};

/**
 * What this visitor's browser is actually holding. It is the one figure on
 * the index pages that is theirs rather than the site's, and it is where the
 * weights can be handed back without hunting through every demo page.
 */
export function DeviceCache({ models }: { models: string[] }) {
  const [state, setState] = useState<CacheState>({ probing: true, cached: 0, bytes: 0 });
  const [confirming, setConfirming] = useState(false);

  const measure = useCallback(async () => {
    const sizes = await Promise.all(models.map((model) => cachedModelSize(model)));
    setState({
      probing: false,
      cached: sizes.filter((size) => size !== null && size > 0).length,
      bytes: sizes.reduce((total: number, size) => total + (size ?? 0), 0),
    });
  }, [models]);

  useEffect(() => {
    void measure();
  }, [measure]);

  async function clearAll() {
    await Promise.all(models.map((model) => clearModelCache(model)));
    setConfirming(false);
    await measure();
  }

  if (state.probing) {
    return (
      <div className="lab-meta-row">
        <span>On this device</span>
        <span>Checking…</span>
      </div>
    );
  }

  return (
    <div className="lab-meta-row">
      <span>On this device</span>
      <span>
        {state.cached === 0
          ? "Nothing cached yet"
          : `${state.cached} of ${models.length} · ${formatBytes(state.bytes)}`}
      </span>
      {state.cached > 0 &&
        (confirming ? (
          <span className="mt-1 flex items-center gap-2">
            <button type="button" onClick={() => void clearAll()} className="chip">
              Clear all
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="chip">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="link-quiet mt-1 w-fit"
          >
            Free the space
          </button>
        ))}
    </div>
  );
}
