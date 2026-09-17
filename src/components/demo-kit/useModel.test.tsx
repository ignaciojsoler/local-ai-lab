import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useModel } from "./useModel";
import type { WorkerLike } from "../../lib/inference-client";

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
    /** Reads the id off the most recently posted message. */
    lastId(): number {
      return (posted[posted.length - 1] as { id: number }).id;
    },
  };
}

beforeEach(() => {
  Object.defineProperty(navigator, "gpu", {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

function renderModel(worker: WorkerLike) {
  return renderHook(() =>
    useModel({
      task: "text-classification",
      model: "Xenova/test-model",
      createWorker: () => worker,
    }),
  );
}

describe("useModel", () => {
  it("starts idle with no progress", () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    expect(result.current.status).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.backend).toBeNull();
  });

  it("moves to ready and records the detected backend after loading", async () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    act(() => fake.emit({ type: "ready", id: fake.lastId() }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.backend).toBe("wasm");
  });

  it("tracks download progress", async () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    act(() =>
      fake.emit({ type: "progress", id: fake.lastId(), file: "model.onnx", progress: 61 }),
    );

    await waitFor(() => expect(result.current.progress).toBe(61));
  });

  it("returns the output and the duration after a run", async () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));
    act(() => fake.emit({ type: "ready", id: fake.lastId() }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let output: unknown;
    act(() => {
      void result.current.run("great movie").then((value) => {
        output = value;
      });
    });
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(1));
    act(() =>
      fake.emit({
        type: "result",
        id: fake.lastId(),
        output: [{ label: "POSITIVE" }],
        durationMs: 27,
      }),
    );

    await waitFor(() => expect(output).toEqual([{ label: "POSITIVE" }]));
    expect(result.current.durationMs).toBe(27);
    expect(result.current.status).toBe("ready");
  });

  it("surfaces a load error without throwing", async () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    act(() => fake.emit({ type: "error", id: fake.lastId(), message: "network unreachable" }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network unreachable");
  });

  it("does not update state or throw an unhandled rejection when unmounted mid-load", async () => {
    const fake = createFakeWorker();
    const { result, unmount } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    unmount();

    // Allow the disposal rejection (which the hook's load() catch handles)
    // to flush through the microtask queue.
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(fake.worker.terminate).toHaveBeenCalled();
  });
});
