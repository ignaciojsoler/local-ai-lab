# local-ai-lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static portfolio site where three Hugging Face models run entirely in the visitor's browser, each with a working demo, a written explanation, and Python/JavaScript integration snippets.

**Architecture:** Astro in static mode renders prose from an MDX content collection; each use case mounts a single React island. All inference happens inside a Web Worker driven by a transport-agnostic client, so the main thread never blocks. A shared `demo-kit` supplies loading, progress, backend reporting, and result rendering to every demo.

**Tech Stack:** Astro 5 (static), React 19 islands, Tailwind CSS, `@huggingface/transformers` v3, Vitest + Testing Library, deployed to Vercel.

**Spec:** `docs/superpowers/specs/2026-09-17-local-ai-lab-design.md`

## Global Constraints

- All code, comments, documentation, README, UI copy, examples, and commit messages are written in **English**. The repository contains no Spanish.
- Astro runs in `output: 'static'`. No adapter, no serverless functions, no server-side code of any kind.
- No model is fetched on page load. Every download is triggered by an explicit user action that states the size first.
- All inference runs inside a Web Worker. Never call a transformers.js pipeline from the main thread.
- WebGPU is attempted first and falls back to WASM. The fallback is mandatory, not optional.
- Model weights are fetched from the Hugging Face CDN. Never commit or self-host weights.
- Base theme is Astro Nano (MIT), taken as a starting point. Astro is upgraded to current on day one.
- Adding a fourth use case must require only a new `.mdx` entry plus one island component. If a task forces a change to `demo-kit` or `lib/`, that is a design failure — stop and report it.
- Colors are defined as CSS custom properties so light mode can be added later. No hardcoded hex values in components.

---

### Task 1: Project scaffold

**Files:**
- Create: the whole project tree, from the Astro Nano template
- Modify: `package.json`, `astro.config.mjs`, `tsconfig.json`
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm run dev`, `npm run build`, and `npm test`; React islands enabled via `@astrojs/react`

- [ ] **Step 1: Scaffold from Astro Nano into the existing repo**

The repo already contains `.git` and `docs/`. Clone the template into a temporary directory and copy its contents in, preserving the existing git history.

```bash
cd /home/ignacio/Documents/GitHub/local-ai-lab
git clone --depth 1 https://github.com/markhorn-dev/astro-nano.git /tmp/astro-nano
rm -rf /tmp/astro-nano/.git
cp -r /tmp/astro-nano/. .
rm -rf /tmp/astro-nano
```

- [ ] **Step 2: Upgrade Astro and add React, Vitest, transformers.js**

```bash
npx @astrojs/upgrade
npx astro add react --yes
npm install @huggingface/transformers
npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @vitejs/plugin-react
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add the test script to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test suite and the build**

Run: `npm test`
Expected: PASS, 1 test.

Run: `npm run build`
Expected: the build completes and writes `dist/`.

- [ ] **Step 6: Strip unused theme features**

Astro Nano ships a blog and a work/projects section that this site does not use. Delete their routes and content directories, and remove their links from the site navigation component. Keep the layout, the typography, and the theme toggle scaffolding.

Run: `npm run build`
Expected: the build still completes with no broken-link or missing-collection errors.

- [ ] **Step 7: Set the color tokens**

In the global stylesheet, confirm the theme colors are declared as CSS custom properties on `:root`. If Astro Nano hardcodes any, lift them into custom properties now. No component may reference a raw hex value.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro Nano with React, Tailwind, and Vitest"
```

---

### Task 2: Backend detection

**Files:**
- Create: `src/lib/backend.ts`
- Test: `src/lib/backend.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Backend = "webgpu" | "wasm"` and `detectBackend(): Promise<Backend>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/backend.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBackend } from "./backend";

function setGpu(gpu: unknown) {
  Object.defineProperty(navigator, "gpu", {
    value: gpu,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setGpu(undefined);
});

describe("detectBackend", () => {
  it("falls back to wasm when the browser has no WebGPU", async () => {
    setGpu(undefined);
    await expect(detectBackend()).resolves.toBe("wasm");
  });

  it("returns webgpu when an adapter is available", async () => {
    setGpu({ requestAdapter: vi.fn().mockResolvedValue({}) });
    await expect(detectBackend()).resolves.toBe("webgpu");
  });

  it("falls back to wasm when no adapter is granted", async () => {
    setGpu({ requestAdapter: vi.fn().mockResolvedValue(null) });
    await expect(detectBackend()).resolves.toBe("wasm");
  });

  it("falls back to wasm when requesting an adapter throws", async () => {
    setGpu({ requestAdapter: vi.fn().mockRejectedValue(new Error("denied")) });
    await expect(detectBackend()).resolves.toBe("wasm");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/backend.test.ts`
Expected: FAIL — cannot resolve `./backend`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/backend.ts`:

```ts
export type Backend = "webgpu" | "wasm";

/**
 * Picks the fastest inference backend the current browser can actually
 * provide. WebGPU is roughly an order of magnitude faster than WASM, but it
 * is unavailable on many browser and hardware combinations, so every failure
 * path here degrades to WASM rather than surfacing an error.
 */
export async function detectBackend(): Promise<Backend> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return "wasm";

  try {
    const adapter = await gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/backend.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backend.ts src/lib/backend.test.ts
git commit -m "feat: detect WebGPU with a WASM fallback"
```

---

### Task 3: Inference worker and client

**Files:**
- Create: `src/lib/workers/inference.worker.ts`
- Create: `src/lib/inference-client.ts`
- Test: `src/lib/inference-client.test.ts`
- Delete: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: `Backend` from `src/lib/backend.ts`
- Produces:
  - `type ProgressUpdate = { file: string; progress: number }`
  - `type InferenceClient = { load(onProgress?: (u: ProgressUpdate) => void): Promise<void>; run<T>(input: unknown, options?: Record<string, unknown>): Promise<{ output: T; durationMs: number }>; dispose(): void }`
  - `createInferenceClient(config: { task: string; model: string; device: Backend; createWorker: () => WorkerLike }): InferenceClient`
  - `interface WorkerLike { postMessage(message: unknown): void; addEventListener(type: "message", listener: (event: { data: unknown }) => void): void; terminate(): void }`

The worker is injected through `createWorker` rather than constructed inside the client. That is what makes this testable without a real browser worker, and it is the reason the tests below can run under jsdom.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inference-client.test.ts`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/inference-client.test.ts`
Expected: FAIL — cannot resolve `./inference-client`.

- [ ] **Step 3: Write the client implementation**

Create `src/lib/inference-client.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/inference-client.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the worker**

The worker is thin on purpose: it owns the pipeline and the timing, and nothing else. It is not unit tested — it is a browser boundary, verified by the demos in Tasks 7 through 9.

Create `src/lib/workers/inference.worker.ts`:

```ts
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
```

- [ ] **Step 6: Remove the smoke test and run the full suite**

```bash
rm src/lib/smoke.test.ts
```

Run: `npm test`
Expected: PASS, 10 tests across two files.

- [ ] **Step 7: Commit**

```bash
git add src/lib/inference-client.ts src/lib/inference-client.test.ts src/lib/workers/inference.worker.ts
git rm --cached src/lib/smoke.test.ts 2>/dev/null; git add -A
git commit -m "feat: add worker-backed inference client"
```

---

### Task 4: The useModel hook

**Files:**
- Create: `src/components/demo-kit/useModel.ts`
- Test: `src/components/demo-kit/useModel.test.tsx`

**Interfaces:**
- Consumes: `detectBackend` from `src/lib/backend.ts`; `createInferenceClient`, `WorkerLike`, `ProgressUpdate` from `src/lib/inference-client.ts`
- Produces: `useModel(config: UseModelConfig): UseModelState` where
  - `type ModelStatus = "idle" | "loading" | "ready" | "running" | "error"`
  - `type UseModelConfig = { task: string; model: string; createWorker?: () => WorkerLike }`
  - `type UseModelState = { status: ModelStatus; progress: number; backend: Backend | null; durationMs: number | null; error: string | null; load(): Promise<void>; run<T>(input: unknown, options?: Record<string, unknown>): Promise<T | null> }`

Every demo island consumes this hook and nothing below it. That is what keeps a fourth demo from needing changes in `lib/`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/demo-kit/useModel.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useModel } from "./useModel";
import type { WorkerLike } from "../../lib/inference-client";

function createFakeWorker() {
  const listeners: Array<(event: { data: unknown }) => void> = [];

  const worker: WorkerLike = {
    postMessage: vi.fn(),
    addEventListener: (_type, listener) => listeners.push(listener),
    terminate: vi.fn(),
  };

  return {
    worker,
    emit(data: unknown) {
      for (const listener of listeners) listener({ data });
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

    act(() => fake.emit({ type: "ready" }));

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

    act(() => fake.emit({ type: "progress", file: "model.onnx", progress: 61 }));

    await waitFor(() => expect(result.current.progress).toBe(61));
  });

  it("returns the output and the duration after a run", async () => {
    const fake = createFakeWorker();
    const { result } = renderModel(fake.worker);

    act(() => {
      void result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("loading"));
    act(() => fake.emit({ type: "ready" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let output: unknown;
    act(() => {
      void result.current.run("great movie").then((value) => {
        output = value;
      });
    });
    act(() => fake.emit({ type: "result", output: [{ label: "POSITIVE" }], durationMs: 27 }));

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

    act(() => fake.emit({ type: "error", message: "network unreachable" }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network unreachable");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/demo-kit/useModel.test.tsx`
Expected: FAIL — cannot resolve `./useModel`.

- [ ] **Step 3: Write the implementation**

Create `src/components/demo-kit/useModel.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { detectBackend, type Backend } from "../../lib/backend";
import {
  createInferenceClient,
  type InferenceClient,
  type WorkerLike,
} from "../../lib/inference-client";

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
  load(): Promise<void>;
  run<T>(input: unknown, options?: Record<string, unknown>): Promise<T | null>;
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

  const clientRef = useRef<InferenceClient | null>(null);

  useEffect(() => {
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const load = useCallback(async () => {
    if (clientRef.current) return;

    setStatus("loading");
    setError(null);

    const device = await detectBackend();
    setBackend(device);

    const client = createInferenceClient({
      task: config.task,
      model: config.model,
      device,
      createWorker: config.createWorker ?? defaultWorkerFactory,
    });
    clientRef.current = client;

    try {
      await client.load((update) => setProgress(update.progress));
      setStatus("ready");
    } catch (cause) {
      clientRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, [config.task, config.model, config.createWorker]);

  const run = useCallback(async <T,>(input: unknown, options?: Record<string, unknown>) => {
    const client = clientRef.current;
    if (!client) return null;

    setStatus("running");
    setError(null);

    try {
      const result = await client.run<T>(input, options);
      setDurationMs(result.durationMs);
      setStatus("ready");
      return result.output;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
      return null;
    }
  }, []);

  return { status, progress, backend, durationMs, error, load, run };
}
```

Note that `load` sets `status` to `"loading"` before awaiting `detectBackend()`, which is what lets the tests observe the loading state.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/demo-kit/useModel.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/demo-kit/useModel.ts src/components/demo-kit/useModel.test.tsx
git commit -m "feat: add useModel hook wrapping the inference client"
```

---

### Task 5: Shared demo components

**Files:**
- Create: `src/components/demo-kit/BackendBadge.tsx`
- Create: `src/components/demo-kit/ModelLoader.tsx`
- Create: `src/components/demo-kit/ConfidenceBar.tsx`
- Create: `src/components/demo-kit/DemoShell.tsx`
- Test: `src/components/demo-kit/demo-kit.test.tsx`

**Interfaces:**
- Consumes: `ModelStatus`, `UseModelState` from `./useModel`; `Backend` from `src/lib/backend.ts`
- Produces:
  - `BackendBadge(props: { backend: Backend | null; durationMs: number | null })`
  - `ModelLoader(props: { status: ModelStatus; progress: number; sizeLabel: string; onLoad(): void })`
  - `ConfidenceBar(props: { label: string; score: number })` — `score` is 0–1
  - `DemoShell(props: { model: UseModelState; sizeLabel: string; children: React.ReactNode })`

`DemoShell` is the contract every demo relies on: it renders the loader until the model is ready, then renders `children` alongside the backend badge, and shows the error state if one appears. A new demo gets all of this for free.

- [ ] **Step 1: Write the failing tests**

Create `src/components/demo-kit/demo-kit.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackendBadge } from "./BackendBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { DemoShell } from "./DemoShell";
import { ModelLoader } from "./ModelLoader";
import type { UseModelState } from "./useModel";

function modelState(overrides: Partial<UseModelState> = {}): UseModelState {
  return {
    status: "idle",
    progress: 0,
    backend: null,
    durationMs: null,
    error: null,
    load: vi.fn(),
    run: vi.fn(),
    ...overrides,
  };
}

describe("BackendBadge", () => {
  it("renders nothing before a backend is known", () => {
    const { container } = render(<BackendBadge backend={null} durationMs={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the backend and the timing", () => {
    render(<BackendBadge backend="webgpu" durationMs={48} />);
    expect(screen.getByText(/WebGPU/)).toBeInTheDocument();
    expect(screen.getByText(/48\s*ms/)).toBeInTheDocument();
  });

  it("labels the CPU fallback plainly", () => {
    render(<BackendBadge backend="wasm" durationMs={890} />);
    expect(screen.getByText(/WASM \(CPU\)/)).toBeInTheDocument();
  });
});

describe("ModelLoader", () => {
  it("states the download size before the model is fetched", () => {
    render(<ModelLoader status="idle" progress={0} sizeLabel="~65 MB" onLoad={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Load model \(~65 MB\)/ })).toBeInTheDocument();
  });

  it("calls onLoad when the button is pressed", async () => {
    const onLoad = vi.fn();
    render(<ModelLoader status="idle" progress={0} sizeLabel="~65 MB" onLoad={onLoad} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("shows a progress bar while loading", () => {
    render(<ModelLoader status="loading" progress={42} sizeLabel="~65 MB" onLoad={vi.fn()} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
  });
});

describe("ConfidenceBar", () => {
  it("renders the label and the score as a percentage", () => {
    render(<ConfidenceBar label="POSITIVE" score={0.9312} />);
    expect(screen.getByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("93.1%")).toBeInTheDocument();
  });
});

describe("DemoShell", () => {
  it("shows the loader and hides the demo until the model is ready", () => {
    render(
      <DemoShell model={modelState()} sizeLabel="~65 MB">
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByRole("button", { name: /Load model/ })).toBeInTheDocument();
    expect(screen.queryByText("demo body")).not.toBeInTheDocument();
  });

  it("shows the demo and the badge once ready", () => {
    render(
      <DemoShell
        model={modelState({ status: "ready", backend: "wasm", durationMs: 120 })}
        sizeLabel="~65 MB"
      >
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByText("demo body")).toBeInTheDocument();
    expect(screen.getByText(/WASM \(CPU\)/)).toBeInTheDocument();
  });

  it("surfaces an error message", () => {
    render(
      <DemoShell
        model={modelState({ status: "error", error: "network unreachable" })}
        sizeLabel="~65 MB"
      >
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("network unreachable");
  });
});
```

`userEvent` needs installing:

```bash
npm install -D @testing-library/user-event
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/demo-kit/demo-kit.test.tsx`
Expected: FAIL — the four component modules do not resolve.

- [ ] **Step 3: Write BackendBadge**

Create `src/components/demo-kit/BackendBadge.tsx`:

```tsx
import type { Backend } from "../../lib/backend";

const LABELS: Record<Backend, string> = {
  webgpu: "WebGPU",
  wasm: "WASM (CPU)",
};

/**
 * Names the backend the model actually ran on. This explains latency to
 * visitors on a CPU fallback, and it is part of the point the page is making.
 */
export function BackendBadge({
  backend,
  durationMs,
}: {
  backend: Backend | null;
  durationMs: number | null;
}) {
  if (!backend) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded border border-current/20 px-2 py-1 font-mono text-xs opacity-80">
      <span>{LABELS[backend]}</span>
      {durationMs !== null && <span>· {durationMs} ms</span>}
    </span>
  );
}
```

- [ ] **Step 4: Write ModelLoader**

Create `src/components/demo-kit/ModelLoader.tsx`:

```tsx
import type { ModelStatus } from "./useModel";

/**
 * Nothing is downloaded until the visitor asks for it, and the size is stated
 * before the first byte is fetched.
 */
export function ModelLoader({
  status,
  progress,
  sizeLabel,
  onLoad,
}: {
  status: ModelStatus;
  progress: number;
  sizeLabel: string;
  onLoad(): void;
}) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Model download progress"
          className="h-1 w-full overflow-hidden rounded bg-current/10"
        >
          <div className="h-full bg-current transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-mono text-xs opacity-70">Downloading model… {progress}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="w-fit rounded border border-current/30 px-3 py-2 font-mono text-sm hover:bg-current/5"
      >
        Load model ({sizeLabel})
      </button>
      <p className="text-xs opacity-60">
        Runs entirely in your browser. Cached after the first download.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Write ConfidenceBar**

Create `src/components/demo-kit/ConfidenceBar.tsx`:

```tsx
export function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const percent = score * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-xs">
        <span>{label}</span>
        <span className="opacity-70">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-current/10">
        <div className="h-full bg-current" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write DemoShell**

Create `src/components/demo-kit/DemoShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { BackendBadge } from "./BackendBadge";
import { ModelLoader } from "./ModelLoader";
import type { UseModelState } from "./useModel";

/**
 * The frame every demo sits in: gate the model download, report the backend,
 * and surface errors. A new demo supplies only its own inputs and outputs.
 */
export function DemoShell({
  model,
  sizeLabel,
  children,
}: {
  model: UseModelState;
  sizeLabel: string;
  children: ReactNode;
}) {
  const isReady = model.status === "ready" || model.status === "running";

  return (
    <section className="not-prose flex flex-col gap-4 rounded border border-current/15 p-4">
      {!isReady && (
        <ModelLoader
          status={model.status}
          progress={model.progress}
          sizeLabel={sizeLabel}
          onLoad={() => void model.load()}
        />
      )}

      {model.error && (
        <p role="alert" className="font-mono text-xs text-red-400">
          {model.error}
        </p>
      )}

      {isReady && (
        <>
          <div className="flex justify-end">
            <BackendBadge backend={model.backend} durationMs={model.durationMs} />
          </div>
          {children}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/demo-kit/demo-kit.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/demo-kit package.json package-lock.json
git commit -m "feat: add shared demo shell, loader, badge, and confidence bar"
```

---

### Task 6: Content collection, code tabs, and the demo page template

**Files:**
- Create: `src/content.config.ts`
- Create: `src/components/demo-kit/CodeTabs.astro`
- Create: `src/pages/demos/index.astro`
- Create: `src/pages/demos/[...slug].astro`
- Create: `src/content/demos/sentiment-analysis.mdx` (prose only; the island arrives in Task 7)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: a `demos` collection whose frontmatter is `{ title, summary, task, model, sizeLabel, order }`, and a route at `/demos/<slug>` that renders any entry in it

- [ ] **Step 1: Enable MDX**

```bash
npx astro add mdx --yes
```

- [ ] **Step 2: Define the collection**

Create `src/content.config.ts`:

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const demos = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/demos" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** transformers.js pipeline task, e.g. "text-classification". */
    task: z.string(),
    /** Hugging Face model id, e.g. "Xenova/vit-base-patch16-224". */
    model: z.string(),
    /** Human-readable download size shown before fetching, e.g. "~67 MB". */
    sizeLabel: z.string(),
    /** Display order on the index page. */
    order: z.number(),
  }),
});

export const collections = { demos };
```

If Astro Nano already defines collections in this file, merge the `demos` entry into the existing export rather than overwriting it.

- [ ] **Step 3: Write CodeTabs**

Create `src/components/demo-kit/CodeTabs.astro`. It takes two named slots and toggles between them with a small inline script — no framework needed for two buttons.

```astro
---
const tabId = `code-tabs-${Math.random().toString(36).slice(2, 9)}`;
---

<div class="not-prose my-6 rounded border border-current/15" data-code-tabs id={tabId}>
  <div class="flex gap-1 border-b border-current/15 p-1" role="tablist">
    <button type="button" role="tab" data-tab="python" aria-selected="true"
      class="rounded px-3 py-1 font-mono text-xs aria-selected:bg-current/10">Python</button>
    <button type="button" role="tab" data-tab="javascript" aria-selected="false"
      class="rounded px-3 py-1 font-mono text-xs aria-selected:bg-current/10">JavaScript</button>
  </div>

  <div data-panel="python"><slot name="python" /></div>
  <div data-panel="javascript" hidden><slot name="javascript" /></div>
</div>

<script>
  for (const root of document.querySelectorAll("[data-code-tabs]")) {
    root.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("[data-tab]");
      if (!button) return;

      const selected = button.getAttribute("data-tab");
      for (const tab of root.querySelectorAll("[data-tab]")) {
        tab.setAttribute("aria-selected", String(tab.getAttribute("data-tab") === selected));
      }
      for (const panel of root.querySelectorAll("[data-panel]")) {
        (panel as HTMLElement).hidden = panel.getAttribute("data-panel") !== selected;
      }
    });
  }
</script>
```

- [ ] **Step 4: Write the demo page template**

Create `src/pages/demos/[...slug].astro`. Use whatever layout component Astro Nano provides for a content page; the shape below assumes `PageLayout`.

```astro
---
import { getCollection, render } from "astro:content";
import PageLayout from "@/layouts/PageLayout.astro";

export async function getStaticPaths() {
  const demos = await getCollection("demos");
  return demos.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---

<PageLayout title={entry.data.title} description={entry.data.summary}>
  <article class="prose prose-invert max-w-none">
    <h1>{entry.data.title}</h1>
    <p class="lead">{entry.data.summary}</p>
    <p class="font-mono text-xs opacity-60">
      {entry.data.task} · {entry.data.model}
    </p>
    <Content />
  </article>
</PageLayout>
```

- [ ] **Step 5: Write the index page**

Create `src/pages/demos/index.astro` listing every entry sorted by `order`, each linking to `/demos/<id>` and showing its `title` and `summary`.

- [ ] **Step 6: Write the first content entry, prose only**

Create `src/content/demos/sentiment-analysis.mdx` with the frontmatter below and placeholder-free prose covering what the use case is, what the model is, and how it works. The island is added in Task 7.

```mdx
---
title: "Review sentiment analysis"
summary: "Classify a product review as positive or negative, without sending a single character to a server."
task: "text-classification"
model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
sizeLabel: "~67 MB"
order: 1
---
```

Verify the real size in Task 7 Step 1 and correct `sizeLabel` if it differs.

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: the build completes and emits `dist/demos/sentiment-analysis/index.html`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add demos content collection, code tabs, and page template"
```

---

### Task 7: Sentiment analysis demo

**Files:**
- Create: `src/components/demos/SentimentDemo.tsx`
- Modify: `src/content/demos/sentiment-analysis.mdx`
- Test: `src/components/demos/SentimentDemo.test.tsx`

**Interfaces:**
- Consumes: `useModel` from `demo-kit/useModel`; `DemoShell`, `ConfidenceBar`
- Produces: `SentimentDemo(props: { model: string; sizeLabel: string })`, a default-exported React island

Each demo component takes its model id and size as props from the MDX frontmatter. It never hardcodes them, so the same component could serve a different checkpoint later.

- [ ] **Step 1: Verify the real download size**

```bash
curl -sIL "https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/onnx/model_quantized.onnx" | grep -i "^content-length"
```

Convert the byte count to megabytes and use it for `sizeLabel` in the MDX frontmatter. If the path 404s, list the repo's `onnx/` directory on the Hugging Face site and use the quantized file transformers.js actually requests.

- [ ] **Step 2: Write the failing test**

Create `src/components/demos/SentimentDemo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SentimentDemo from "./SentimentDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 31,
    error: null,
    load: vi.fn(),
    run: vi.fn().mockResolvedValue([{ label: "POSITIVE", score: 0.9812 }]),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("SentimentDemo", () => {
  it("renders the classified label and score after analyzing", async () => {
    const state = mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Loved it");
    await userEvent.click(screen.getByRole("button", { name: /Analyze/ }));

    expect(state.run).toHaveBeenCalledWith("Loved it");
    expect(await screen.findByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("98.1%")).toBeInTheDocument();
  });

  it("fills the textarea when a sample review is picked", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    const sample = screen.getAllByRole("button", { name: /^Sample/ })[0];
    await userEvent.click(sample);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).not.toBe("");
  });

  it("disables the analyze button on empty input", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.clear(screen.getByRole("textbox"));

    expect(screen.getByRole("button", { name: /Analyze/ })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/demos/SentimentDemo.test.tsx`
Expected: FAIL — cannot resolve `./SentimentDemo`.

- [ ] **Step 4: Write the implementation**

Create `src/components/demos/SentimentDemo.tsx`:

```tsx
import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type Prediction = { label: string; score: number };

const SAMPLES = [
  "The battery lasts all day and the screen is gorgeous. Worth every penny.",
  "Arrived scratched, and support never replied. I want a refund.",
  "It does the job, though the app crashes more often than I would like.",
];

export default function SentimentDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(SAMPLES[0]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const modelState = useModel({ task: "text-classification", model });

  async function analyze() {
    const output = await modelState.run<Prediction[]>(text);
    setPrediction(output?.[0] ?? null);
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample, index) => (
            <button
              key={sample}
              type="button"
              onClick={() => setText(sample)}
              className="rounded border border-current/20 px-2 py-1 font-mono text-xs hover:bg-current/5"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          aria-label="Review text"
          className="w-full rounded border border-current/20 bg-transparent p-3 text-sm"
        />

        <button
          type="button"
          onClick={() => void analyze()}
          disabled={text.trim() === "" || modelState.status === "running"}
          className="w-fit rounded border border-current/30 px-3 py-2 font-mono text-sm disabled:opacity-40"
        >
          {modelState.status === "running" ? "Analyzing…" : "Analyze"}
        </button>

        {prediction && <ConfidenceBar label={prediction.label} score={prediction.score} />}
      </div>
    </DemoShell>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/demos/SentimentDemo.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Mount the island and write the page prose**

In `src/content/demos/sentiment-analysis.mdx`, import the component and mount it with `client:visible` so the island hydrates only when scrolled into view. Then write the three prose sections and the code tabs.

```mdx
import SentimentDemo from "../../components/demos/SentimentDemo.tsx";
import CodeTabs from "../../components/demo-kit/CodeTabs.astro";

<SentimentDemo client:visible model={frontmatter.model} sizeLabel={frontmatter.sizeLabel} />

## How it works

Write a section explaining that the model is DistilBERT fine-tuned on SST-2:
the text is tokenized into subword ids, run through the encoder, and the final
layer produces two logits that softmax into a positive/negative probability.
State that the model is English-only and was trained on movie reviews, which is
why it can be confidently wrong on other domains.

## Integration

<CodeTabs>
  <Fragment slot="python">
```python
from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="distilbert-base-uncased-finetuned-sst-2-english",
)

print(classifier("The battery lasts all day and the screen is gorgeous."))
# [{'label': 'POSITIVE', 'score': 0.9998}]
```
  </Fragment>
  <Fragment slot="javascript">
```javascript
import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
  { device: "webgpu" },
);

console.log(await classifier("The battery lasts all day and the screen is gorgeous."));
// [{ label: 'POSITIVE', score: 0.9998 }]
```
  </Fragment>
</CodeTabs>
```

If `frontmatter` is not exposed in this Astro version's MDX scope, pass the literal model id and size label instead and keep them in sync with the frontmatter.

- [ ] **Step 7: Verify it works in a browser**

Run: `npm run dev`

Open `/demos/sentiment-analysis`, confirm that nothing downloads until the load button is pressed, that the progress bar advances, that a classification returns, and that the backend badge names a backend and a duration. Reload and confirm the second load is near-instant from the IndexedDB cache.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add sentiment analysis demo"
```

---

### Task 8: Image classification demo

**Files:**
- Create: `src/components/demos/ImageClassificationDemo.tsx`
- Create: `src/content/demos/image-classification.mdx`
- Create: `public/samples/` with three or four sample images
- Test: `src/components/demos/ImageClassificationDemo.test.tsx`

**Interfaces:**
- Consumes: `useModel`, `DemoShell`, `ConfidenceBar`
- Produces: `ImageClassificationDemo(props: { model: string; sizeLabel: string })`

- [ ] **Step 1: Verify the real download size**

```bash
curl -sIL "https://huggingface.co/Xenova/vit-base-patch16-224/resolve/main/onnx/model_quantized.onnx" | grep -i "^content-length"
```

Use the result for `sizeLabel`.

- [ ] **Step 2: Add sample images**

Place three or four royalty-free photographs in `public/samples/` with descriptive filenames, each under 200 KB, covering visually distinct subjects (for example an animal, a vehicle, a food dish, an everyday object). They exist so a visitor never has to go find a photo to try the demo.

- [ ] **Step 3: Write the failing test**

Create `src/components/demos/ImageClassificationDemo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ImageClassificationDemo from "./ImageClassificationDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "webgpu",
    durationMs: 48,
    error: null,
    load: vi.fn(),
    run: vi.fn().mockResolvedValue([
      { label: "golden retriever", score: 0.81 },
      { label: "Labrador retriever", score: 0.12 },
    ]),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("ImageClassificationDemo", () => {
  it("classifies a sample image and lists the top predictions", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /^Sample/ })[0]);

    expect(state.run).toHaveBeenCalled();
    expect(await screen.findByText("golden retriever")).toBeInTheDocument();
    expect(screen.getByText("Labrador retriever")).toBeInTheDocument();
  });

  it("classifies an uploaded file", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    const file = new File(["binary"], "photo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Upload an image/), file);

    expect(state.run).toHaveBeenCalled();
    expect(await screen.findByText("golden retriever")).toBeInTheDocument();
  });

  it("requests the top five predictions", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /^Sample/ })[0]);

    expect(state.run).toHaveBeenCalledWith(expect.any(String), { top_k: 5 });
  });
});
```

`URL.createObjectURL` is not implemented in jsdom. Add this to `src/test/setup.ts`:

```ts
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => "blob:mock";
  globalThis.URL.revokeObjectURL = () => {};
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/components/demos/ImageClassificationDemo.test.tsx`
Expected: FAIL — cannot resolve `./ImageClassificationDemo`.

- [ ] **Step 5: Write the implementation**

Create `src/components/demos/ImageClassificationDemo.tsx`:

```tsx
import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type Prediction = { label: string; score: number };

const SAMPLES = [
  "/samples/dog.jpg",
  "/samples/espresso.jpg",
  "/samples/bicycle.jpg",
];

export default function ImageClassificationDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  const modelState = useModel({ task: "image-classification", model });

  async function classify(url: string) {
    setImageUrl(url);
    setPredictions([]);
    const output = await modelState.run<Prediction[]>(url, { top_k: 5 });
    setPredictions(output ?? []);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void classify(URL.createObjectURL(file));
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => void classify(src)}
              className="rounded border border-current/20 px-2 py-1 font-mono text-xs hover:bg-current/5"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>

        <label className="flex w-fit cursor-pointer flex-col gap-1 font-mono text-xs">
          <span>Upload an image</span>
          <input type="file" accept="image/*" onChange={handleUpload} className="text-xs" />
        </label>

        {imageUrl && (
          <img src={imageUrl} alt="" className="max-h-64 w-fit rounded border border-current/15" />
        )}

        {modelState.status === "running" && (
          <p className="font-mono text-xs opacity-70">Classifying…</p>
        )}

        {predictions.length > 0 && (
          <div className="flex flex-col gap-2">
            {predictions.map((prediction) => (
              <ConfidenceBar
                key={prediction.label}
                label={prediction.label}
                score={prediction.score}
              />
            ))}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/demos/ImageClassificationDemo.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 7: Write the content entry**

Create `src/content/demos/image-classification.mdx` with this frontmatter and the same four-part structure as Task 7:

```mdx
---
title: "Image classification"
summary: "Drop in a photo and get the top five ImageNet labels, computed on your own machine."
task: "image-classification"
model: "Xenova/vit-base-patch16-224"
sizeLabel: "<measured in Step 1>"
order: 2
---
```

The "How it works" section should explain that a Vision Transformer splits the image into 16×16 patches, treats each patch as a token, and classifies over the 1000 ImageNet categories — which is also why it can only answer with labels from that fixed list.

The Python snippet uses `pipeline("image-classification", model="google/vit-base-patch16-224")`; the JavaScript snippet uses the `Xenova/` ONNX conversion.

- [ ] **Step 8: Verify in a browser and commit**

Run: `npm run dev`, open `/demos/image-classification`, and confirm sample images and an uploaded file both classify correctly.

```bash
git add -A
git commit -m "feat: add image classification demo"
```

---

### Task 9: Zero-shot classification demo

**Files:**
- Create: `src/components/demos/ZeroShotDemo.tsx`
- Create: `src/content/demos/zero-shot-classification.mdx`
- Test: `src/components/demos/ZeroShotDemo.test.tsx`

**Interfaces:**
- Consumes: `useModel`, `DemoShell`, `ConfidenceBar`
- Produces: `ZeroShotDemo(props: { model: string; sizeLabel: string })`

The transformers.js zero-shot pipeline returns `{ sequence: string; labels: string[]; scores: number[] }` — parallel arrays, not a list of objects. The component zips them before rendering.

- [ ] **Step 1: Verify the real download size**

```bash
curl -sIL "https://huggingface.co/Xenova/nli-deberta-v3-xsmall/resolve/main/onnx/model_quantized.onnx" | grep -i "^content-length"
```

- [ ] **Step 2: Write the failing test**

Create `src/components/demos/ZeroShotDemo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ZeroShotDemo from "./ZeroShotDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 210,
    error: null,
    load: vi.fn(),
    run: vi.fn().mockResolvedValue({
      sequence: "My package never arrived",
      labels: ["shipping", "billing", "product quality"],
      scores: [0.88, 0.07, 0.05],
    }),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("ZeroShotDemo", () => {
  it("passes the text and the parsed labels to the model", async () => {
    const state = mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.clear(screen.getByLabelText(/Text to classify/));
    await userEvent.type(screen.getByLabelText(/Text to classify/), "My package never arrived");
    await userEvent.clear(screen.getByLabelText(/Candidate labels/));
    await userEvent.type(screen.getByLabelText(/Candidate labels/), "shipping, billing");
    await userEvent.click(screen.getByRole("button", { name: /Classify/ }));

    expect(state.run).toHaveBeenCalledWith("My package never arrived", {
      candidate_labels: ["shipping", "billing"],
    });
  });

  it("renders each label with its score", async () => {
    mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.click(screen.getByRole("button", { name: /Classify/ }));

    expect(await screen.findByText("shipping")).toBeInTheDocument();
    expect(screen.getByText("88.0%")).toBeInTheDocument();
    expect(screen.getByText("product quality")).toBeInTheDocument();
  });

  it("disables classify until at least two labels are given", async () => {
    mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.clear(screen.getByLabelText(/Candidate labels/));
    await userEvent.type(screen.getByLabelText(/Candidate labels/), "shipping");

    expect(screen.getByRole("button", { name: /Classify/ })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/demos/ZeroShotDemo.test.tsx`
Expected: FAIL — cannot resolve `./ZeroShotDemo`.

- [ ] **Step 4: Write the implementation**

Create `src/components/demos/ZeroShotDemo.tsx`:

```tsx
import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type ZeroShotOutput = { sequence: string; labels: string[]; scores: number[] };

const DEFAULT_TEXT = "My package never arrived and nobody answered my emails.";
const DEFAULT_LABELS = "shipping, billing, product quality";

function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label !== "");
}

export default function ZeroShotDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rawLabels, setRawLabels] = useState(DEFAULT_LABELS);
  const [results, setResults] = useState<Array<{ label: string; score: number }>>([]);

  const modelState = useModel({ task: "zero-shot-classification", model });
  const labels = parseLabels(rawLabels);

  async function classify() {
    setResults([]);
    const output = await modelState.run<ZeroShotOutput>(text, { candidate_labels: labels });
    if (!output) return;
    setResults(output.labels.map((label, index) => ({ label, score: output.scores[index] })));
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span>Text to classify</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="w-full rounded border border-current/20 bg-transparent p-3 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 font-mono text-xs">
          <span>Candidate labels (comma separated)</span>
          <input
            value={rawLabels}
            onChange={(event) => setRawLabels(event.target.value)}
            className="w-full rounded border border-current/20 bg-transparent p-3 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => void classify()}
          disabled={
            text.trim() === "" || labels.length < 2 || modelState.status === "running"
          }
          className="w-fit rounded border border-current/30 px-3 py-2 font-mono text-sm disabled:opacity-40"
        >
          {modelState.status === "running" ? "Classifying…" : "Classify"}
        </button>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((result) => (
              <ConfidenceBar key={result.label} label={result.label} score={result.score} />
            ))}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/demos/ZeroShotDemo.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the content entry**

Create `src/content/demos/zero-shot-classification.mdx` with this frontmatter and the same four-part structure:

```mdx
---
title: "Zero-shot classification"
summary: "Invent your own categories and classify text into them, with no training data and no fine-tuning."
task: "zero-shot-classification"
model: "Xenova/nli-deberta-v3-xsmall"
sizeLabel: "<measured in Step 1>"
order: 3
---
```

This page carries the most explanatory weight of the three, because the capability is the least widely understood. The "How it works" section should make the mechanism concrete: the model was trained on natural language inference, so each candidate label is turned into a hypothesis ("This example is about shipping."), the model scores how strongly the input entails each hypothesis, and those entailment scores are normalized into the ranking shown. That is why new labels work without retraining, and also why label wording changes the result.

- [ ] **Step 7: Verify in a browser and commit**

Run: `npm run dev`, open `/demos/zero-shot-classification`, and confirm that changing the labels changes the ranking.

```bash
git add -A
git commit -m "feat: add zero-shot classification demo"
```

---

### Task 10: Deployment, home page, and README

**Files:**
- Create: `vercel.json`
- Create: `README.md`
- Modify: `src/pages/index.astro`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: the `demos` collection from Task 6
- Produces: a deployable static site

- [ ] **Step 1: Confirm static output and set the site URL**

In `astro.config.mjs`, confirm `output: 'static'` (or that no `output` is set, which defaults to static) and that no adapter is configured. Set `site` to the production Vercel URL.

- [ ] **Step 2: Add the cross-origin isolation headers**

Multi-threaded WASM requires cross-origin isolation. Without these headers the CPU fallback runs single-threaded, penalizing exactly the machines that have no WebGPU.

Create `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

`credentialless` is used rather than `require-corp` because model weights are fetched cross-origin from the Hugging Face CDN, which does not send `Cross-Origin-Resource-Policy` headers. Under `require-corp` those fetches would be blocked and every demo would fail.

- [ ] **Step 3: Write the home page**

Rewrite `src/pages/index.astro` to introduce the project in a short paragraph — models running fully in the browser, no backend, no API keys — and list the three demos from the collection, sorted by `order`, each linking to its page.

- [ ] **Step 4: Write the README**

Create `README.md` in English covering: what the project is, the stack, how to run it locally (`npm install`, `npm run dev`, `npm test`, `npm run build`), the architecture in a short paragraph, how to add a new demo (one MDX entry plus one island component), and a note that the cross-origin isolation headers in `vercel.json` are required for multi-threaded WASM.

- [ ] **Step 5: Run the full suite and a production build**

Run: `npm test`
Expected: PASS, all tests across all files.

Run: `npm run build && npm run preview`
Expected: the build succeeds; all three demo pages work against the preview server.

- [ ] **Step 6: Verify cross-origin isolation after deploying**

Deploy to Vercel, open the deployed site, and in the browser console evaluate `crossOriginIsolated`.
Expected: `true`. If it is `false`, the headers in `vercel.json` are not being applied and multi-threaded WASM is silently disabled.

Then confirm on the deployed site that a model still downloads and runs — this is what catches a `require-corp`-style misconfiguration blocking the Hugging Face CDN.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add deployment config, home page, and README"
```
