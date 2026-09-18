/**
 * A pipeline result reduced to what can cross a worker boundary.
 *
 * transformers.js returns its own Tensor class for the embedding pipelines.
 * That class carries private fields, and structured clone refuses it outright
 * ("#<_Tensor> could not be cloned"), so the worker has to hand over the
 * numbers rather than the object holding them. Everything else — the arrays
 * of `{ label, score }` the classification pipelines return — already clones
 * cleanly and is passed through untouched.
 */
type TensorLike = {
  type: string;
  data: ArrayLike<number>;
  dims: number[];
};

function isTensorLike(value: unknown): value is TensorLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TensorLike>;
  return (
    Array.isArray(candidate.dims) &&
    typeof candidate.type === "string" &&
    candidate.data !== undefined &&
    typeof candidate.data !== "function"
  );
}

export function toStructuredCloneable(value: unknown): unknown {
  if (isTensorLike(value)) {
    return { type: value.type, data: value.data, dims: value.dims };
  }

  if (Array.isArray(value) && value.some(isTensorLike)) {
    return value.map(toStructuredCloneable);
  }

  return value;
}
