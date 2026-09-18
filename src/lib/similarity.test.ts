import { describe, expect, it } from "vitest";
import { rankBySimilarity, type EmbeddingMatrix } from "./similarity";

/** Row 0 is the query; the remaining rows line up with `documents`. */
function matrix(rows: number[][]): EmbeddingMatrix {
  return { data: Float32Array.from(rows.flat()), dims: [rows.length, rows[0].length] };
}

describe("rankBySimilarity", () => {
  it("ranks the document pointing the same way as the query first", () => {
    const ranked = rankBySimilarity(
      matrix([
        [1, 0],
        [0, 1],
        [1, 0],
      ]),
      ["orthogonal", "identical"],
    );

    expect(ranked.map((entry) => entry.document)).toEqual(["identical", "orthogonal"]);
    expect(ranked[0].score).toBeCloseTo(1);
    expect(ranked[1].score).toBeCloseTo(0);
  });

  it("scores by direction, not by magnitude", () => {
    // The pipeline is asked to normalize, but a longer vector must not win on
    // length alone if it points somewhere else.
    const ranked = rankBySimilarity(
      matrix([
        [1, 0],
        [0, 9],
        [0.6, 0.8],
      ]),
      ["long but wrong", "short and close"],
    );

    expect(ranked[0].document).toBe("short and close");
  });

  it("floors negative similarity at zero so a bar can render it", () => {
    const ranked = rankBySimilarity(
      matrix([
        [1, 0],
        [-1, 0],
      ]),
      ["opposite"],
    );

    expect(ranked[0].score).toBe(0);
  });

  it("returns nothing when there are no documents to rank", () => {
    expect(rankBySimilarity(matrix([[1, 0]]), [])).toEqual([]);
  });
});
