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
  run<T>(input: unknown, options?: Record<string, unknown>): Promise<RunResult<T>>;
  dispose(): void;
}

type WorkerMessage =
  | { type: "progress"; file: string; progress: number }
  | { type: "ready" }
  | { type: "result"; output: unknown; durationMs: number }
  | { type: "error"; message: string };

type Config = {
  task: string;
  model: string;
  device: Backend;
  createWorker: () => WorkerLike;
};

export function createInferenceClient(config: Config): InferenceClient {
  const worker = config.createWorker();

  let onProgress: ((update: ProgressUpdate) => void) | undefined;
  let pendingLoad: { resolve: () => void; reject: (error: Error) => void } | null = null;
  let pendingRun: { resolve: (value: RunResult<never>) => void; reject: (error: Error) => void } | null = null;

  worker.addEventListener("message", (event) => {
    const message = event.data as WorkerMessage;

    switch (message.type) {
      case "progress":
        onProgress?.({ file: message.file, progress: message.progress });
        break;
      case "ready":
        pendingLoad?.resolve();
        pendingLoad = null;
        break;
      case "result":
        pendingRun?.resolve({
          output: message.output,
          durationMs: message.durationMs,
        } as RunResult<never>);
        pendingRun = null;
        break;
      case "error": {
        const error = new Error(message.message);
        pendingRun?.reject(error);
        pendingLoad?.reject(error);
        pendingRun = null;
        pendingLoad = null;
        break;
      }
    }
  });

  return {
    load(progressCallback) {
      onProgress = progressCallback;
      return new Promise<void>((resolve, reject) => {
        pendingLoad = { resolve, reject };
        worker.postMessage({
          type: "load",
          task: config.task,
          model: config.model,
          device: config.device,
        });
      });
    },

    run<T>(input: unknown, options?: Record<string, unknown>) {
      return new Promise<RunResult<T>>((resolve, reject) => {
        pendingRun = {
          resolve: resolve as (value: RunResult<never>) => void,
          reject,
        };
        worker.postMessage({ type: "run", input, options });
      });
    },

    dispose() {
      worker.terminate();
    },
  };
}
