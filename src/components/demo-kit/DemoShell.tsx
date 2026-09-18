import type { ReactNode } from "react";
import { BackendBadge } from "./BackendBadge";
import { ClearModelButton } from "./ClearModelButton";
import { ModelAction, ModelProgress, modelStatusLabel } from "./ModelLoader";
import type { UseModelState } from "./useModel";

/**
 * The instrument panel every demo sits in: state the runtime's condition, gate
 * the download, report the backend, let the visitor take the weights back off
 * their device. A new demo supplies only its own inputs and outputs.
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
    <div className="demo-shell">
      <div className="demo-shell-inner">
        <div className="demo-shell-head">
          <h2 className="demo-shell-title">Local runtime test</h2>
          <span className="eyebrow">{modelStatusLabel(model)}</span>
          <span className="ml-auto flex items-center gap-4">
            {isReady && <BackendBadge backend={model.backend} durationMs={model.durationMs} />}
            <ModelAction model={model} sizeLabel={sizeLabel} />
          </span>
        </div>

        <ModelProgress model={model} sizeLabel={sizeLabel} />

        {model.error && (
          <p
            role="alert"
            className="demo-shell-section font-mono text-xs text-[var(--color-danger)]"
          >
            {model.error}
          </p>
        )}

        {/* The inputs stay on screen before the weights arrive, dimmed and
            inert: the visitor can see what the instrument does before
            committing to a download. */}
        <fieldset
          className="demo-shell-section demo-shell-body"
          disabled={!isReady}
          data-idle={isReady ? undefined : "true"}
        >
          {children}
        </fieldset>

        {model.cached && (
          <div className="demo-shell-footer">
            <ClearModelButton cacheSize={model.cacheSize} onClear={() => model.clear()} />
          </div>
        )}
      </div>
    </div>
  );
}
