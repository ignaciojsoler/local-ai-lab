import { describe, expect, it } from "vitest";
import { toStructuredCloneable } from "./worker-output";

/**
 * transformers.js returns its own Tensor class, which carries private fields
 * and therefore cannot cross a postMessage boundary: the browser rejects it
 * with "#<_Tensor> could not be cloned".
 */
class FakeTensor {
  readonly #ort = { internal: true };
  constructor(
    public type: string,
    public data: Float32Array,
    public dims: number[],
  ) {}
  tolist() {
    return [...this.data];
  }
  get ort() {
    return this.#ort;
  }
}

describe("toStructuredCloneable", () => {
  it("reduces a tensor to the plain fields a reader needs", () => {
    const tensor = new FakeTensor("float32", Float32Array.from([1, 0, 0, 1]), [2, 2]);

    expect(toStructuredCloneable(tensor)).toEqual({
      type: "float32",
      data: Float32Array.from([1, 0, 0, 1]),
      dims: [2, 2],
    });
  });

  it("returns a plain result untouched", () => {
    const predictions = [{ label: "POSITIVE", score: 0.98 }];
    expect(toStructuredCloneable(predictions)).toBe(predictions);
  });

  it("reduces tensors nested in an array", () => {
    const tensor = new FakeTensor("float32", Float32Array.from([1]), [1, 1]);

    expect(toStructuredCloneable([tensor])).toEqual([
      { type: "float32", data: Float32Array.from([1]), dims: [1, 1] },
    ]);
  });

  it("passes through the values a pipeline returns as scalars", () => {
    expect(toStructuredCloneable("a transcript")).toBe("a transcript");
    expect(toStructuredCloneable(null)).toBe(null);
  });
});
