import { useCallback, useEffect, useRef, useState } from "react";
import { detectBackend, type Backend } from "../../lib/backend";
import {
  createInferenceClient,
  type InferenceClient,
  type WorkerLike,
} from "../../lib/inference-client";
import { cachedModelSize, clearModelCache, isModelCached } from "../../lib/model-cache";

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
  /** True once the weights are known to be in this browser's cache. */
  cached: boolean;
  /** True while the cache is still being inspected, before the first paint. */
  probing: boolean;
  /** Bytes the model occupies on this device, when measurable. */
  cacheSize: number | null;
  load(): Promise<void>;
  /** `args` are the pipeline's positional arguments, in transformers.js order. */
  run<T>(args: unknown[], options?: Record<string, unknown>): Promise<T | null>;
  clear(): Promise<void>;
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
  const [cached, setCached] = useState(false);
  const [probing, setProbing] = useState(true);
  const [cacheSize, setCacheSize] = useState<number | null>(null);

  const clientRef = useRef<InferenceClient | null>(null);
  // Set synchronously at the start of load(), before the first await, so a
  // second load() fired before detectBackend() resolves is rejected by this
  // check rather than racing past it (clientRef isn't assigned until after
  // that await). Cleared once loading settles either way.
  const loadingRef = useRef(false);

  useEffect(() => {
    return () => {
      // What actually matters on unmount: dispose the client so its worker
      // is terminated and every pending request is rejected. We do not guard
      // the resulting setState calls against "unmounted" — React 18 already
      // makes a post-unmount setState a silent no-op, and a manual "mounted"
      // ref here would reintroduce the StrictMode hazard fixed in task-4
      // round 2: without reassigning it back to true on every mount, a
      // StrictMode mount -> cleanup -> remount cycle leaves it stuck at
      // false, silently freezing a component that is genuinely mounted.
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current || clientRef.current) return;
    loadingRef.current = true;

    setStatus("loading");
    setError(null);

    try {
      const device = await detectBackend();
      setBackend(device);

      const client = createInferenceClient({
        task: config.task,
        model: config.model,
        device,
        createWorker: config.createWorker ?? defaultWorkerFactory,
      });
      clientRef.current = client;

      await client.load((update) => setProgress(update.progress));
      setStatus("ready");
      // The weights are on the device now, whether or not they already were.
      setCached(true);
      void cachedModelSize(config.model).then(setCacheSize);
    } catch (cause) {
      clientRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [config.task, config.model, config.createWorker]);

  // Keeps the mount-time probe below independent of load()'s identity, which
  // changes whenever a caller passes an inline createWorker.
  const loadRef = useRef(load);
  loadRef.current = load;

  // A model the visitor already downloaded should not ask to be downloaded
  // again on every page they visit. Inspect the cache on mount and, when the
  // weights are already there, bring the model up without any gate: no bytes
  // cross the network, so there is nothing left to consent to.
  useEffect(() => {
    let active = true;

    void (async () => {
      const hit = await isModelCached(config.model);
      if (!active) return;

      setCached(hit);
      setProbing(false);
      if (!hit) return;

      void cachedModelSize(config.model).then((size) => {
        if (active) setCacheSize(size);
      });
      void loadRef.current();
    })();

    return () => {
      active = false;
    };
  }, [config.model]);

  const run = useCallback(async <T,>(args: unknown[], options?: Record<string, unknown>) => {
    const client = clientRef.current;
    if (!client) return null;

    setStatus("running");
    setError(null);

    try {
      const result = await client.run<T>(args, options);
      setDurationMs(result.durationMs);
      setStatus("ready");
      return result.output;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
      return null;
    }
  }, []);

  /** Frees the device: terminate the worker and drop the cached weights. */
  const clear = useCallback(async () => {
    clientRef.current?.dispose();
    clientRef.current = null;
    loadingRef.current = false;

    await clearModelCache(config.model);

    setStatus("idle");
    setProgress(0);
    setBackend(null);
    setDurationMs(null);
    setError(null);
    setCached(false);
    setCacheSize(null);
  }, [config.model]);

  return {
    status,
    progress,
    backend,
    durationMs,
    error,
    cached,
    probing,
    cacheSize,
    load,
    run,
    clear,
  };
}
