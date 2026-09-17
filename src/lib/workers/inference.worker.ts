/// <reference lib="webworker" />
import { pipeline, env, type PipelineType } from "@huggingface/transformers";

// Weights come from the Hugging Face CDN; nothing is served from our origin.
env.allowLocalModels = false;

type LoadMessage = {
  type: "load";
  task: PipelineType;
  model: string;
  device: "webgpu" | "wasm";
};

type RunMessage = {
  type: "run";
  input: unknown;
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
            file: report.file ?? "",
            progress: Math.round(report.progress ?? 0),
          });
        },
      });
      self.postMessage({ type: "ready" });
      return;
    }

    if (message.type === "run") {
      if (!task) throw new Error("Model is not loaded yet");
      const startedAt = performance.now();
      const output = await task(message.input, message.options);
      self.postMessage({
        type: "result",
        output,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
