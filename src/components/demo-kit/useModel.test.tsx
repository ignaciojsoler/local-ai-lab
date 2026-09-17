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

  it("swallows a dispose-triggered rejection on unmount without an unhandled rejection", async () => {
    // NOTE on what this test can and cannot discriminate: an earlier version
    // of this test asserted that `result.current.status`/`.error` are
    // unchanged after unmount, as a proxy for "the mountedRef guard prevented
    // a stale state write." That assertion does NOT discriminate the guard.
    // Verified empirically (see task-4-report.md, "fix round 1" section): with
    // the `if (!mountedRef.current) return;` checks in `load()` temporarily
    // deleted, this component's `status`/`error` after unmount, the
    // `console.error` spy, and the `unhandledRejection` listener are all
    // byte-for-byte identical to the guarded version. That is because
    // `@testing-library/react`'s `unmount()` fully detaches the fiber from
    // its root in React 18: further `setState` calls on it are silent,
    // effect-free no-ops (no warning, no re-render, no commit) whether or not
    // this hook itself guards against them. There is no test-observable
    // difference to assert on for that specific code path with the current
    // public API surface.
    //
    // What IS real and worth covering here: `dispose()` now rejects every
    // pending request, and `load()`'s own `try`/`catch` must actually catch
    // that rejection so it never becomes an unhandled promise rejection. That
    // regresses to red if the `try`/`catch` around the awaited calls in
    // `load()` is removed (verified locally), independent of the mountedRef
    // checks. The mountedRef guard itself is kept as defense-in-depth for
    // environments/renderers where a post-unmount setState is not a no-op.
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

    // Allow the disposal rejection to flush through the microtask queue.
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(fake.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("creates exactly one worker when load() is called twice before backend detection resolves", async () => {
    const fake = createFakeWorker();
    const createWorker = vi.fn(() => fake.worker);
    const { result } = renderHook(() =>
      useModel({
        task: "text-classification",
        model: "Xenova/test-model",
        createWorker,
      }),
    );

    act(() => {
      void result.current.load();
      void result.current.load();
    });

    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(fake.posted.filter((m) => (m as { type: string }).type === "load")).toHaveLength(1);

    act(() => fake.emit({ type: "ready", id: fake.lastId() }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
