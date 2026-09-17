import type { Backend } from "../../lib/backend";

const LABELS: Record<Backend, string> = {
  webgpu: "WebGPU",
  wasm: "WASM (CPU)",
};

/**
 * Names the backend the model actually ran on. This explains latency to
 * visitors on a CPU fallback, and it is part of the point the page is making.
 */
export function BackendBadge({
  backend,
  durationMs,
}: {
  backend: Backend | null;
  durationMs: number | null;
}) {
  if (!backend) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded border border-current/20 px-2 py-1 font-mono text-xs opacity-80">
      <span>{LABELS[backend]}</span>
      {durationMs !== null && <span>· {durationMs} ms</span>}
    </span>
  );
}
