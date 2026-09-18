/**
 * A [rows, dimensions] embedding matrix, exactly as a transformers.js
 * feature-extraction pipeline hands it back across the worker boundary.
 */
export type EmbeddingMatrix = {
  data: Float32Array | number[];
  dims: number[];
};

export type RankedDocument = { document: string; score: number };

function row(matrix: EmbeddingMatrix, index: number): number[] {
  const width = matrix.dims[1];
  const start = index * width;
  return Array.from(matrix.data.slice(start, start + width));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const scale = Math.sqrt(normA) * Math.sqrt(normB);
  return scale === 0 ? 0 : dot / scale;
}

/**
 * Ranks `documents` against the query in row 0 of the same matrix.
 *
 * The similarity is computed rather than assumed: the pipeline is asked to
 * normalize, which would make a plain dot product enough, but a change to
 * that option should not silently turn magnitude into relevance.
 *
 * Negative similarity is floored at zero. A bar cannot be less than empty,
 * and "points the other way" and "points much the other way" are the same
 * answer to the visitor's question.
 */
export function rankBySimilarity(
  matrix: EmbeddingMatrix,
  documents: string[],
): RankedDocument[] {
  const query = row(matrix, 0);

  return documents
    .map((document, index) => ({
      document,
      score: Math.max(0, cosine(query, row(matrix, index + 1))),
    }))
    .sort((a, b) => b.score - a.score);
}
