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
