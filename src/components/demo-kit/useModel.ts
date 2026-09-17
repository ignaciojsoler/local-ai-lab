import { useCallback, useEffect, useRef, useState } from "react";
import { detectBackend, type Backend } from "../../lib/backend";
import {
  createInferenceClient,
  type InferenceClient,
  type WorkerLike,
} from "../../lib/inference-client";

export type ModelStatus = "idle" | "loading" | "ready" | "running" | "error";

export type UseModelConfig = {
  task: string;
  model: string;
  /** Overridden in tests; in the browser the real worker is built here. */
  createWorker?: () => WorkerLike;
};

export type UseModelState = {
  status: ModelStatus;
  progress: number;
  backend: Backend | null;
  durationMs: number | null;
  error: string | null;
  load(): Promise<void>;
  run<T>(input: unknown, options?: Record<string, unknown>): Promise<T | null>;
};

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL("../../lib/workers/inference.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;
}

export function useModel(config: UseModelConfig): UseModelState {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<InferenceClient | null>(null);
  // Guards against state writes settling after this hook has unmounted:
  // dispose() rejects every pending request, and without this flag those
  // rejections would otherwise reach setState on an unmounted component.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const load = useCallback(async () => {
    if (clientRef.current) return;

    setStatus("loading");
    setError(null);

    const device = await detectBackend();
    if (!mountedRef.current) return;
    setBackend(device);

    const client = createInferenceClient({
      task: config.task,
      model: config.model,
      device,
      createWorker: config.createWorker ?? defaultWorkerFactory,
    });
    clientRef.current = client;

    try {
      await client.load((update) => {
        if (mountedRef.current) setProgress(update.progress);
      });
      if (!mountedRef.current) return;
      setStatus("ready");
    } catch (cause) {
      if (clientRef.current === client) clientRef.current = null;
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, [config.task, config.model, config.createWorker]);

  const run = useCallback(async <T,>(input: unknown, options?: Record<string, unknown>) => {
    const client = clientRef.current;
    if (!client) return null;

    setStatus("running");
    setError(null);

    try {
      const result = await client.run<T>(input, options);
      if (!mountedRef.current) return result.output;
      setDurationMs(result.durationMs);
      setStatus("ready");
      return result.output;
    } catch (cause) {
      if (!mountedRef.current) return null;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
      return null;
    }
  }, []);

  return { status, progress, backend, durationMs, error, load, run };
}
