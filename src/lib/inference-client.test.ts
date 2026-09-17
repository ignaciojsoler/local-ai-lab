import { describe, expect, it, vi } from "vitest";
import { createInferenceClient, type WorkerLike } from "./inference-client";

/** A worker stand-in that lets a test drive the messages coming back. */
function createFakeWorker() {
  const listeners: Array<(event: { data: unknown }) => void> = [];
  const posted: unknown[] = [];

  const worker: WorkerLike = {
    postMessage: (message) => posted.push(message),
    addEventListener: (_type, listener) => listeners.push(listener),
    terminate: vi.fn(),
  };

  return {
    worker,
    posted,
    emit(data: unknown) {
      for (const listener of listeners) listener({ data });
    },
  };
}

function createClient() {
  const fake = createFakeWorker();
  const client = createInferenceClient({
    task: "text-classification",
    model: "Xenova/test-model",
    device: "wasm",
    createWorker: () => fake.worker,
  });
  return { client, fake };
}

describe("createInferenceClient", () => {
  it("sends a load message carrying the task, model, and device", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready" });
    await loading;

    expect(fake.posted[0]).toEqual({
      type: "load",
      task: "text-classification",
      model: "Xenova/test-model",
      device: "wasm",
    });
  });

  it("reports download progress while loading", async () => {
    const { client, fake } = createClient();
    const onProgress = vi.fn();

    const loading = client.load(onProgress);
    fake.emit({ type: "progress", file: "model.onnx", progress: 42 });
    fake.emit({ type: "ready" });
    await loading;

    expect(onProgress).toHaveBeenCalledWith({ file: "model.onnx", progress: 42 });
  });

  it("rejects the load when the worker reports an error", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "error", message: "network unreachable" });

    await expect(loading).rejects.toThrow("network unreachable");
  });

  it("resolves run with the worker output and its duration", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready" });
    await loading;

    const running = client.run<{ label: string }>("some text");
    fake.emit({ type: "result", output: { label: "POSITIVE" }, durationMs: 31 });

    await expect(running).resolves.toEqual({
      output: { label: "POSITIVE" },
      durationMs: 31,
    });
  });

  it("rejects run when the worker reports an error", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready" });
    await loading;

    const running = client.run("some text");
    fake.emit({ type: "error", message: "inference failed" });

    await expect(running).rejects.toThrow("inference failed");
  });

  it("terminates the worker on dispose", () => {
    const { client, fake } = createClient();
    client.load();
    client.dispose();
    expect(fake.worker.terminate).toHaveBeenCalled();
  });
});
