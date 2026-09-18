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

/** Reads the id off the most recently posted message. */
function lastId(posted: unknown[]): number {
  return (posted[posted.length - 1] as { id: number }).id;
}

describe("createInferenceClient", () => {
  it("forwards every positional argument the pipeline takes", () => {
    const { client, fake } = createClient();

    void client.run(["a complaint", ["shipping", "billing"]], { multi_label: true });

    expect(fake.posted[fake.posted.length - 1]).toMatchObject({
      type: "run",
      args: ["a complaint", ["shipping", "billing"]],
      options: { multi_label: true },
    });
  });

  it("sends a load message carrying the task, model, and device", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    const id = lastId(fake.posted);
    fake.emit({ type: "ready", id });
    await loading;

    expect(fake.posted[0]).toEqual({
      type: "load",
      id,
      task: "text-classification",
      model: "Xenova/test-model",
      device: "wasm",
    });
  });

  it("reports download progress while loading", async () => {
    const { client, fake } = createClient();
    const onProgress = vi.fn();

    const loading = client.load(onProgress);
    const id = lastId(fake.posted);
    fake.emit({ type: "progress", id, file: "model.onnx", progress: 42 });
    fake.emit({ type: "ready", id });
    await loading;

    expect(onProgress).toHaveBeenCalledWith({ file: "model.onnx", progress: 42 });
  });

  it("rejects the load when the worker reports an error", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    const id = lastId(fake.posted);
    fake.emit({ type: "error", id, message: "network unreachable" });

    await expect(loading).rejects.toThrow("network unreachable");
  });

  it("resolves run with the worker output and its duration", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready", id: lastId(fake.posted) });
    await loading;

    const running = client.run<{ label: string }>(["some text"]);
    const runId = lastId(fake.posted);
    fake.emit({ type: "result", id: runId, output: { label: "POSITIVE" }, durationMs: 31 });

    await expect(running).resolves.toEqual({
      output: { label: "POSITIVE" },
      durationMs: 31,
    });
  });

  it("rejects run when the worker reports an error", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready", id: lastId(fake.posted) });
    await loading;

    const running = client.run(["some text"]);
    const runId = lastId(fake.posted);
    fake.emit({ type: "error", id: runId, message: "inference failed" });

    await expect(running).rejects.toThrow("inference failed");
  });

  it("terminates the worker on dispose", () => {
    const { client, fake } = createClient();
    client.load().catch(() => {});
    client.dispose();
    expect(fake.worker.terminate).toHaveBeenCalled();
  });

  it("settles only the run when it errors while a load is still in flight", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    const loadId = lastId(fake.posted);

    const running = client.run(["some text"]);
    const runId = lastId(fake.posted);

    fake.emit({ type: "error", id: runId, message: "inference failed" });
    await expect(running).rejects.toThrow("inference failed");

    fake.emit({ type: "ready", id: loadId });
    await expect(loading).resolves.toBeUndefined();
  });

  it("settles two overlapping run calls independently", async () => {
    const { client, fake } = createClient();

    const loading = client.load();
    fake.emit({ type: "ready", id: lastId(fake.posted) });
    await loading;

    const runningA = client.run<{ label: string }>(["text a"]);
    const idA = lastId(fake.posted);
    const runningB = client.run<{ label: string }>(["text b"]);
    const idB = lastId(fake.posted);

    expect(idA).not.toBe(idB);

    fake.emit({ type: "result", id: idB, output: { label: "B" }, durationMs: 5 });
    fake.emit({ type: "result", id: idA, output: { label: "A" }, durationMs: 10 });

    await expect(runningA).resolves.toEqual({ output: { label: "A" }, durationMs: 10 });
    await expect(runningB).resolves.toEqual({ output: { label: "B" }, durationMs: 5 });
  });
});
