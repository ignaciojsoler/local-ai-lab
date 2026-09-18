import { describe, expect, it } from "vitest";
import { toMono } from "./audio";

describe("toMono", () => {
  it("returns a single channel untouched", () => {
    // Values exactly representable in float32, so the assertion tests the
    // mixing rather than the storage format.
    const left = Float32Array.from([0.5, -0.25, 0.75]);
    expect(Array.from(toMono([left]))).toEqual([0.5, -0.25, 0.75]);
  });

  it("averages the channels of a stereo recording", () => {
    // Whisper is trained on mono. Summing without dividing would clip a loud
    // stereo clip into distortion; averaging keeps it in range.
    const left = Float32Array.from([1, 0, -1]);
    const right = Float32Array.from([0, 1, -1]);

    expect(Array.from(toMono([left, right]))).toEqual([0.5, 0.5, -1]);
  });

  it("averages more than two channels", () => {
    const channels = [
      Float32Array.from([3]),
      Float32Array.from([0]),
      Float32Array.from([0]),
    ];
    expect(toMono(channels)[0]).toBeCloseTo(1);
  });

  it("refuses a recording with no channels rather than returning silence", () => {
    expect(() => toMono([])).toThrow(/no audio/i);
  });
});
