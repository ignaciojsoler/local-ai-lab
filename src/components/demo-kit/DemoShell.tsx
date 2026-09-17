import type { ReactNode } from "react";
import { BackendBadge } from "./BackendBadge";
import { ModelLoader } from "./ModelLoader";
import type { UseModelState } from "./useModel";

/**
 * The frame every demo sits in: gate the model download, report the backend,
 * and surface errors. A new demo supplies only its own inputs and outputs.
 */
export function DemoShell({
  model,
  sizeLabel,
  children,
}: {
  model: UseModelState;
  sizeLabel: string;
  children: ReactNode;
}) {
  const isReady = model.status === "ready" || model.status === "running";

  return (
    <section className="not-prose demo-shell">
      {!isReady && (
        <ModelLoader
          status={model.status}
          progress={model.progress}
          sizeLabel={sizeLabel}
          onLoad={() => void model.load()}
        />
      )}

      {model.error && (
        <p role="alert" className="font-mono text-xs text-[var(--color-danger)]">
          {model.error}
        </p>
      )}

      {isReady && (
        <>
          <div className="flex justify-end">
            <BackendBadge backend={model.backend} durationMs={model.durationMs} />
          </div>
          {children}
        </>
      )}
    </section>
  );
}
