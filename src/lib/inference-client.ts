import type { Backend } from "./backend";

export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  terminate(): void;
}

export type ProgressUpdate = { file: string; progress: number };

export type RunResult<T> = { output: T; durationMs: number };

export interface InferenceClient {
  load(onProgress?: (update: ProgressUpdate) => void): Promise<void>;
  /**
   * `args` are the pipeline's positional arguments, in transformers.js order:
   * `[text]` for a classifier, `[text, candidateLabels]` for zero-shot. The
   * options object is always the pipeline's last parameter, never a carrier
   * for positional data.
   */
  run<T>(args: unknown[], options?: Record<string, unknown>): Promise<RunResult<T>>;
  dispose(): void;
}

type WorkerMessage =
  | { type: "progress"; id: number; file: string; progress: number }
  | { type: "ready"; id: number }
  | { type: "result"; id: number; output: unknown; durationMs: number }
  | { type: "error"; id: number; message: string };

type Config = {
  task: string;
  model: string;
  device: Backend;
  createWorker: () => WorkerLike;
};

type PendingLoad = {
  kind: "load";
  resolve: () => void;
  reject: (error: Error) => void;
  onProgress?: (update: ProgressUpdate) => void;
};

type PendingRun = {
  kind: "run";
  resolve: (value: RunResult<never>) => void;
  reject: (error: Error) => void;
};

type Pending = PendingLoad | PendingRun;

export function createInferenceClient(config: Config): InferenceClient {
  const worker = config.createWorker();

  let nextId = 1;
  const pending = new Map<number, Pending>();

  worker.addEventListener("message", (event) => {
    const message = event.data as WorkerMessage;
    const entry = pending.get(message.id);

    switch (message.type) {
      case "progress":
        if (entry?.kind === "load") {
          entry.onProgress?.({ file: message.file, progress: message.progress });
        }
        break;
      case "ready":
        if (entry?.kind === "load") {
          pending.delete(message.id);
          entry.resolve();
        }
        break;
      case "result":
        if (entry?.kind === "run") {
          pending.delete(message.id);
          entry.resolve({
            output: message.output,
            durationMs: message.durationMs,
          } as RunResult<never>);
        }
        break;
      case "error":
        if (entry) {
          pending.delete(message.id);
          entry.reject(new Error(message.message));
        }
        break;
    }
  });

  return {
    load(onProgress) {
      const id = nextId++;
      return new Promise<void>((resolve, reject) => {
        pending.set(id, { kind: "load", resolve, reject, onProgress });
        worker.postMessage({
          type: "load",
          id,
          task: config.task,
          model: config.model,
          device: config.device,
        });
      });
    },

    run<T>(args: unknown[], options?: Record<string, unknown>) {
      const id = nextId++;
      return new Promise<RunResult<T>>((resolve, reject) => {
        pending.set(id, {
          kind: "run",
          resolve: resolve as (value: RunResult<never>) => void,
          reject,
        });
        worker.postMessage({ type: "run", id, args, options });
      });
    },

    dispose() {
      for (const entry of pending.values()) {
        entry.reject(new Error("Inference client disposed"));
      }
      pending.clear();
      worker.terminate();
    },
  };
}
