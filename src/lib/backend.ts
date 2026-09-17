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
