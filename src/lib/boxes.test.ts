import { describe, expect, it } from "vitest";
import { toOverlayRect, type DetectionBox } from "./boxes";

/** transformers.js returns 0..1 coordinates when `percentage: true`. */
function box(xmin: number, ymin: number, xmax: number, ymax: number): DetectionBox {
  return { xmin, ymin, xmax, ymax };
}

describe("toOverlayRect", () => {
  it("places a box as percentages of the rendered image", () => {
    expect(toOverlayRect(box(0.1, 0.2, 0.5, 0.6))).toEqual({
      left: 10,
      top: 20,
      width: 40,
      height: 40,
    });
  });

  it("keeps a box that runs past the edge inside the image", () => {
    // DETR regularly returns coordinates slightly outside 0..1 for objects
    // that touch the frame; drawn unclamped they overflow the layout.
    expect(toOverlayRect(box(-0.05, 0.5, 1.2, 1.4))).toEqual({
      left: 0,
      top: 50,
      width: 100,
      height: 50,
    });
  });

  it("survives a box whose corners arrive in the wrong order", () => {
    expect(toOverlayRect(box(0.8, 0.9, 0.2, 0.3))).toEqual({
      left: 20,
      top: 30,
      width: 60,
      height: 60,
    });
  });
});
