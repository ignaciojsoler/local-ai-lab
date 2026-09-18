import { StrictMode } from "react";
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
      void result.current.run(["great movie"]).then((value) => {
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
    // unchanged after unmount, as a proxy for "a mountedRef guard prevented a
    // stale state write." That assertion did NOT discriminate such a guard.
    // Verified empirically (see task-4-report.md, "fix round 1" section):
    // with a `mountedRef`-style `if (!mountedRef.current) return;` check
    // added to `load()`, this component's `status`/`error` after unmount,
    // the `console.error` spy, and the `unhandledRejection` listener were all
    // byte-for-byte identical whether or not that check existed. That is
    // because `@testing-library/react`'s `unmount()` fully detaches the
    // fiber from its root in React 18: further `setState` calls on it are
    // silent, effect-free no-ops (no warning, no re-render, no commit)
    // regardless of any such guard.
    //
    // Round 2 removed that guard entirely: besides being provably inert here,
    // it was actively unsafe under React StrictMode, where a mount -> cleanup
    // -> remount cycle set it to `false` in the cleanup with nothing to reset
    // it to `true` on remount, permanently freezing a genuinely mounted
    // component. See the "StrictMode" test below for that regression.
    //
    // What IS real and worth covering here: `dispose()` now rejects every
    // pending request, and `load()`'s own `try`/`catch` must actually catch
    // that rejection so it never becomes an unhandled promise rejection. That
    // regresses to red if the `try`/`catch` around the awaited calls in
    // `load()` is removed (verified locally).
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

  it("reaches ready under React StrictMode's mount -> cleanup -> remount cycle", async () => {
    // Regression for task-4 round 2: a `mountedRef`-style flag flipped to
    // `false` in the unmount cleanup, with nothing to reset it to `true` on
    // remount, would leave StrictMode's synchronous mount -> cleanup ->
    // remount stuck at `false` forever — freezing a component that is
    // genuinely mounted. This test renders under StrictMode and asserts a
    // load actually completes.
    const fake = createFakeWorker();
    const { result } = renderHook(
      () =>
        useModel({
          task: "text-classification",
          model: "Xenova/test-model",
          createWorker: () => fake.worker,
        }),
      { wrapper: StrictMode },
    );

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0));

    act(() => fake.emit({ type: "ready", id: fake.lastId() }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
