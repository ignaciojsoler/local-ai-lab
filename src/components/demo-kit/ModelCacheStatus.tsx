import { useEffect, useState } from "react";
import { cachedModelSize, formatBytes } from "../../lib/model-cache";

/**
 * Whether this one model is on this device, measured rather than assumed.
 * The row it replaces was a static green dot reading "weights (local)", which
 * said the same thing on a machine that had never downloaded anything.
 */
export function ModelCacheStatus({ model }: { model: string }) {
  const [bytes, setBytes] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void cachedModelSize(model).then((size) => {
      if (active) setBytes(size);
    });
    return () => {
      active = false;
    };
  }, [model]);

  if (bytes === undefined) return <p className="eyebrow">Checking cache…</p>;

  if (bytes === null || bytes === 0) {
    return <p className="eyebrow">Not on this device</p>;
  }

  return (
    <p className="eyebrow">
      On this device · {formatBytes(bytes)} <span className="signal-dot" aria-hidden="true" />
    </p>
  );
}
