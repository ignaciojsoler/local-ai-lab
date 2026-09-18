import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedModelSize, clearModelCache, formatBytes, isModelCached } from "./model-cache";

const MODEL = "Xenova/test-model";

/** A Cache Storage stub holding the URLs given, keyed like the real one. */
function stubCaches(urls: string[], bytesPerFile = 1024 * 1024) {
  const keys = urls.map((url) => ({ url }) as Request);
  const deleted: string[] = [];

  const cache = {
    keys: vi.fn(async () => keys),
    match: vi.fn(async () => ({
      clone: () => ({ arrayBuffer: async () => new ArrayBuffer(bytesPerFile) }),
    })),
    delete: vi.fn(async (request: Request) => {
      deleted.push(request.url);
      return true;
    }),
  };

  vi.stubGlobal("caches", {
    has: vi.fn(async () => true),
    open: vi.fn(async () => cache),
  });

  return { deleted };
}

afterEach(() => vi.unstubAllGlobals());

describe("model-cache", () => {
  it("reports no cache when Cache Storage is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(isModelCached(MODEL)).resolves.toBe(false);
  });

  it("recognises weights already stored for the model", async () => {
    stubCaches([`https://huggingface.co/${MODEL}/resolve/main/onnx/model.onnx`]);
    await expect(isModelCached(MODEL)).resolves.toBe(true);
  });

  it("ignores weights belonging to a different model", async () => {
    stubCaches(["https://huggingface.co/Xenova/other-model/resolve/main/model.onnx"]);
    await expect(isModelCached(MODEL)).resolves.toBe(false);
  });

  it("adds up the bytes the model occupies", async () => {
    stubCaches([
      `https://huggingface.co/${MODEL}/resolve/main/onnx/model.onnx`,
      `https://huggingface.co/${MODEL}/resolve/main/tokenizer.json`,
    ]);
    await expect(cachedModelSize(MODEL)).resolves.toBe(2 * 1024 * 1024);
  });

  it("deletes only the model's own entries", async () => {
    const { deleted } = stubCaches([
      `https://huggingface.co/${MODEL}/resolve/main/onnx/model.onnx`,
      "https://huggingface.co/Xenova/other-model/resolve/main/model.onnx",
    ]);

    await expect(clearModelCache(MODEL)).resolves.toBe(1);
    expect(deleted).toEqual([`https://huggingface.co/${MODEL}/resolve/main/onnx/model.onnx`]);
  });

  it("formats sizes the way a download prompt would", () => {
    expect(formatBytes(68_157_440)).toBe("65 MB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.0 GB");
  });
});
