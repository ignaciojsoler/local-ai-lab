/// <reference lib="webworker" />
import { pipeline, env, type PipelineType } from "@huggingface/transformers";

// Weights come from the Hugging Face CDN; nothing is served from our origin.
env.allowLocalModels = false;

type LoadMessage = {
  type: "load";
  id: number;
  task: PipelineType;
  model: string;
  device: "webgpu" | "wasm";
};

type RunMessage = {
  type: "run";
  id: number;
  /** Positional pipeline arguments, in transformers.js order. */
  args: unknown[];
  options?: Record<string, unknown>;
};

type IncomingMessage = LoadMessage | RunMessage;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let task: any = null;

self.addEventListener("message", async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  try {
    if (message.type === "load") {
      task = await pipeline(message.task, message.model, {
        device: message.device,
        progress_callback: (report: { file?: string; progress?: number; status: string }) => {
          if (report.status !== "progress") return;
          self.postMessage({
            type: "progress",
            id: message.id,
            file: report.file ?? "",
            progress: Math.round(report.progress ?? 0),
          });
        },
      });
      self.postMessage({ type: "ready", id: message.id });
      return;
    }

    if (message.type === "run") {
      if (!task) throw new Error("Model is not loaded yet");
      const startedAt = performance.now();
      // Spread rather than pass a single input: several pipelines take
      // positional arguments beyond the first (zero-shot classification
      // takes its candidate labels there, not in the options object).
      const output = await task(...message.args, message.options ?? {});
      self.postMessage({
        type: "result",
        id: message.id,
        output,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
