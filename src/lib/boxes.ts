/** A detection box in 0..1 coordinates, as returned with `percentage: true`. */
export type DetectionBox = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

/** A rectangle in percentages of the rendered image, ready for CSS. */
export type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Percentages rather than pixels so the overlay tracks the image through
 * every viewport width without recomputing anything: the boxes are laid out
 * by the same box model as the photo they sit on.
 */
export function toOverlayRect(box: DetectionBox): OverlayRect {
  const left = clamp(Math.min(box.xmin, box.xmax) * 100);
  const right = clamp(Math.max(box.xmin, box.xmax) * 100);
  const top = clamp(Math.min(box.ymin, box.ymax) * 100);
  const bottom = clamp(Math.max(box.ymin, box.ymax) * 100);

  return { left, top, width: right - left, height: bottom - top };
}
